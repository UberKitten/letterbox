const API_BASE = import.meta.env.VITE_API_URL || "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
  });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function getLoginUrl(): string {
  return `${API_BASE}/auth/login`;
}

export function getMe() {
  return apiFetch<{ displayName: string; mail: string }>("/auth/me");
}

export function logout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function getFolders() {
  return apiFetch<{ folders: any[] }>("/api/folders");
}

export interface MessagePage {
  messages: any[];
  totalCount: number;
  startIndex: number;
}

export function getMessages(params: {
  folderIds: string[];
  skip?: number;
  filter?: string;
  category?: string | null;
}): Promise<MessagePage> {
  const { folderIds, skip = 0, filter = "unread", category } = params;

  if (folderIds.length === 1) {
    const qs = new URLSearchParams({ skip: String(skip), filter });
    if (category) qs.set("category", category);
    return apiFetch<MessagePage>(
      `/api/folders/${folderIds[0]}/messages?${qs}`,
    );
  }

  const qs = new URLSearchParams({
    folderIds: folderIds.join(","),
    skip: String(skip),
    filter,
  });
  if (category) qs.set("category", category);
  return apiFetch<MessagePage>(`/api/messages/aggregate?${qs}`);
}

export function markAsRead(messageId: string) {
  return apiFetch<{ ok: boolean }>(`/api/messages/${messageId}/read`, {
    method: "PATCH",
  });
}

export function markAsUnread(messageId: string) {
  return apiFetch<{ ok: boolean }>(`/api/messages/${messageId}/unread`, {
    method: "PATCH",
  });
}

export function toggleFlag(messageId: string, flagged: boolean) {
  return apiFetch<{ ok: boolean }>(`/api/messages/${messageId}/flag`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flagged }),
  });
}

export function getCategories() {
  return apiFetch<{ categories: any[] }>("/api/categories");
}

export function getPreferences() {
  return apiFetch<{ selectedFolderIds: string[] }>("/api/preferences");
}

export function savePreferences(prefs: { selectedFolderIds: string[] }) {
  return apiFetch<{ ok: boolean }>("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
}
