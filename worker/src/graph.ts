import type { IRequest } from "itty-router";
import type { Env } from "./env";
import { withAuth } from "./middleware";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MESSAGE_SELECT =
  "id,subject,from,receivedDateTime,body,isRead,parentFolderId,flag,categories";
const PAGE_SIZE = 10;

async function graphFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  return fetch(`${GRAPH_BASE}${path}`, { ...options, headers });
}

async function getAllFolders(
  accessToken: string,
  parentId?: string,
): Promise<any[]> {
  const path = parentId
    ? `/me/mailFolders/${parentId}/childFolders?$top=100&$select=id,displayName,parentFolderId,unreadItemCount,totalItemCount,childFolderCount`
    : `/me/mailFolders?$top=100&$select=id,displayName,parentFolderId,unreadItemCount,totalItemCount,childFolderCount`;

  const res = await graphFetch(path, accessToken);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error: ${res.status} ${text}`);
  }

  const data: { value: any[] } = await res.json();
  const folders = data.value;

  const withChildren = await Promise.all(
    folders.map(async (folder: any) => {
      if (folder.childFolderCount > 0) {
        folder.childFolders = await getAllFolders(accessToken, folder.id);
      }
      return folder;
    }),
  );

  return withChildren;
}

function buildFilter(
  filter?: string | null,
  category?: string | null,
): string | null {
  const parts: string[] = [];

  switch (filter) {
    case "unread":
      parts.push("isRead eq false");
      break;
    case "read":
      parts.push("isRead eq true");
      break;
    case "flagged":
      parts.push("flag/flagStatus eq 'flagged'");
      break;
  }

  if (category) {
    parts.push(`categories/any(c:c eq '${category}')`);
  }

  return parts.length > 0 ? parts.join(" and ") : null;
}

// Run promises in batches to avoid Graph MailboxConcurrency throttling
async function batchedPromises<T>(
  fns: (() => Promise<T>)[],
  batchSize: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += batchSize) {
    const batch = fns.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function graphRoutes(router: any) {
  router.get("/api/folders", withAuth, async (request: IRequest, env: Env) => {
    const folders = await getAllFolders(request.accessToken);
    return Response.json({ folders });
  });

  // Unified message endpoint — works for single or multiple folders
  // Fetches a page of messages from all selected folders, merges by date
  router.get(
    "/api/folders/:folderId/messages",
    withAuth,
    async (request: IRequest, env: Env) => {
      const { folderId } = request.params;
      const url = new URL(request.url);
      const skip = parseInt(url.searchParams.get("skip") || "0", 10);
      const filter = url.searchParams.get("filter") || "unread";
      const category = url.searchParams.get("category");

      const filterStr = buildFilter(filter, category);
      const isFlagged = filter === "flagged";
      // Fetch enough to fill a page starting at skip
      const fetchCount = skip + PAGE_SIZE + 1;

      let path = `/me/mailFolders/${folderId}/messages?$top=${fetchCount}&$select=${MESSAGE_SELECT}`;
      if (!isFlagged) {
        path += `&$orderby=receivedDateTime desc`;
      }
      if (filterStr) {
        path += `&$filter=${filterStr}`;
      }

      const res = await graphFetch(path, request.accessToken);
      if (!res.ok) {
        const text = await res.text();
        console.log("single folder fetch error:", res.status, text);
        return new Response(text, { status: res.status });
      }

      const data: { value: any[]; "@odata.nextLink"?: string } = await res.json();
      const allMessages = data.value;
      if (isFlagged) {
        allMessages.sort(
          (a: any, b: any) =>
            new Date(b.receivedDateTime).getTime() -
            new Date(a.receivedDateTime).getTime(),
        );
      }
      const page = allMessages.slice(skip, skip + PAGE_SIZE);
      const hasMore = !!data["@odata.nextLink"] || allMessages.length > skip + PAGE_SIZE;
      const totalCount = hasMore
        ? Math.max(allMessages.length, skip + PAGE_SIZE + 1)
        : allMessages.length;

      return Response.json({
        messages: page,
        totalCount,
        startIndex: skip,
      });
    },
  );

  router.get(
    "/api/messages/aggregate",
    withAuth,
    async (request: IRequest, env: Env) => {
      const url = new URL(request.url);
      const folderIds = (url.searchParams.get("folderIds") || "")
        .split(",")
        .filter(Boolean);
      const skip = parseInt(url.searchParams.get("skip") || "0", 10);
      const filter = url.searchParams.get("filter") || "unread";
      const category = url.searchParams.get("category");

      if (folderIds.length === 0) {
        return Response.json({ messages: [], totalCount: 0, startIndex: 0 });
      }

      const filterStr = buildFilter(filter, category);
      const isFlagged = filter === "flagged";
      const perFolder = Math.max(skip + PAGE_SIZE + 1, 25);

      // Batch folder requests to avoid MailboxConcurrency throttling
      const folderFetchers = folderIds.map((folderId) => async () => {
        // Omit $orderby for flagged — Graph rejects flag filter + orderby combo
        let path = `/me/mailFolders/${folderId}/messages?$top=${perFolder}&$select=${MESSAGE_SELECT}`;
        if (!isFlagged) {
          path += `&$orderby=receivedDateTime desc`;
        }
        if (filterStr) {
          path += `&$filter=${filterStr}`;
        }
        const res = await graphFetch(path, request.accessToken);
        if (!res.ok) {
          const errText = await res.text();
          console.log("fetch error for folder", folderId, res.status, errText);
          return { messages: [] as any[], hasMore: false };
        }
        const data: { value: any[]; "@odata.nextLink"?: string } = await res.json();
        return { messages: data.value, hasMore: !!data["@odata.nextLink"] };
      });

      const results = await batchedPromises(folderFetchers, 4);
      const allMessages = results.flatMap((r) => r.messages);
      const anyHasMore = results.some((r) => r.hasMore);

      allMessages.sort(
        (a, b) =>
          new Date(b.receivedDateTime).getTime() -
          new Date(a.receivedDateTime).getTime(),
      );

      const page = allMessages.slice(skip, skip + PAGE_SIZE);
      const totalCount = anyHasMore
        ? Math.max(allMessages.length, skip + PAGE_SIZE + 1)
        : allMessages.length;

      return Response.json({
        messages: page,
        totalCount,
        startIndex: skip,
      });
    },
  );

  router.get(
    "/api/categories",
    withAuth,
    async (request: IRequest, env: Env) => {
      const res = await graphFetch(
        "/me/outlook/masterCategories",
        request.accessToken,
      );
      if (!res.ok) {
        const text = await res.text();
        return new Response(text, { status: res.status });
      }
      const data: { value: any[] } = await res.json();
      return Response.json({ categories: data.value });
    },
  );

  router.patch(
    "/api/messages/:messageId/read",
    withAuth,
    async (request: IRequest, env: Env) => {
      const { messageId } = request.params;
      const res = await graphFetch(
        `/me/messages/${messageId}`,
        request.accessToken,
        {
          method: "PATCH",
          body: JSON.stringify({ isRead: true }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return new Response(text, { status: res.status });
      }
      return Response.json({ ok: true });
    },
  );

  router.patch(
    "/api/messages/:messageId/unread",
    withAuth,
    async (request: IRequest, env: Env) => {
      const { messageId } = request.params;
      const res = await graphFetch(
        `/me/messages/${messageId}`,
        request.accessToken,
        {
          method: "PATCH",
          body: JSON.stringify({ isRead: false }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return new Response(text, { status: res.status });
      }
      return Response.json({ ok: true });
    },
  );

  router.patch(
    "/api/messages/:messageId/flag",
    withAuth,
    async (request: IRequest, env: Env) => {
      const { messageId } = request.params;
      const body = (await request.json()) as { flagged?: boolean };
      const flagStatus = body?.flagged ? "flagged" : "notFlagged";
      const res = await graphFetch(
        `/me/messages/${messageId}`,
        request.accessToken,
        {
          method: "PATCH",
          body: JSON.stringify({ flag: { flagStatus } }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return new Response(text, { status: res.status });
      }
      return Response.json({ ok: true });
    },
  );

  router.patch(
    "/api/preferences",
    withAuth,
    async (request: IRequest, env: Env) => {
      const body = await request.json();
      await env.SESSIONS.put(
        `prefs:${request.session.userId}`,
        JSON.stringify(body),
      );
      return Response.json({ ok: true });
    },
  );

  router.get(
    "/api/preferences",
    withAuth,
    async (request: IRequest, env: Env) => {
      const raw = await env.SESSIONS.get(
        `prefs:${request.session.userId}`,
      );
      return Response.json(
        raw ? JSON.parse(raw) : { selectedFolderIds: [] },
      );
    },
  );
}
