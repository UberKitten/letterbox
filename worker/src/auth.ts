import type { IRequest } from "itty-router";
import type { Env } from "./env";
import {
  generateSessionId,
  getSession,
  saveSession,
  deleteSession,
  getSessionId,
  sessionCookie,
  clearSessionCookie,
} from "./session";
import { exchangeCodeForTokens, encrypt } from "./tokens";

const AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const SCOPES = "Mail.ReadWrite User.Read offline_access";

function getRedirectUri(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}/auth/callback`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authRoutes(router: any) {
  router.get("/auth/login", async (request: IRequest, env: Env) => {
    const state = generateSessionId();
    await env.SESSIONS.put(`auth_state:${state}`, "1", {
      expirationTtl: 600,
    });

    const params = new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      response_type: "code",
      redirect_uri: getRedirectUri(request.url),
      scope: SCOPES,
      state,
      response_mode: "query",
      prompt: "select_account",
    });

    return Response.redirect(`${AUTH_URL}?${params}`, 302);
  });

  router.get("/auth/callback", async (request: IRequest, env: Env) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const origin = env.ALLOWED_ORIGIN || url.origin;

    if (error) {
      const desc = url.searchParams.get("error_description") || error;
      return Response.redirect(
        `${origin}/?error=${encodeURIComponent(desc)}`,
        302,
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${origin}/?error=${encodeURIComponent("Missing code or state")}`,
        302,
      );
    }

    const storedState = await env.SESSIONS.get(`auth_state:${state}`);
    if (!storedState) {
      return Response.redirect(
        `${origin}/?error=${encodeURIComponent("Invalid or expired state")}`,
        302,
      );
    }
    await env.SESSIONS.delete(`auth_state:${state}`);

    const tokens = await exchangeCodeForTokens(
      code,
      getRedirectUri(request.url),
      env,
    );

    // Get user info
    const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      return Response.redirect(
        `${origin}/?error=${encodeURIComponent("Failed to fetch user info")}`,
        302,
      );
    }
    const user: { displayName: string; mail: string; userPrincipalName: string } = await userRes.json();

    const encryptedRefresh = await encrypt(
      tokens.refresh_token,
      env.TOKEN_ENCRYPTION_KEY,
    );

    const sessionId = generateSessionId();
    await saveSession(env, sessionId, {
      userId: user.mail || user.userPrincipalName,
      displayName: user.displayName,
      mail: user.mail || user.userPrincipalName,
      encryptedRefreshToken: encryptedRefresh,
      accessToken: tokens.access_token,
      accessTokenExpiry: Date.now() + tokens.expires_in * 1000 - 60000,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: origin + "/",
        "Set-Cookie": sessionCookie(sessionId, origin),
      },
    });
  });

  router.post("/auth/logout", async (request: IRequest, env: Env) => {
    const sessionId = getSessionId(request);
    const origin = env.ALLOWED_ORIGIN || new URL(request.url).origin;
    if (sessionId) {
      await deleteSession(env, sessionId);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(origin),
      },
    });
  });

  router.get("/auth/me", async (request: IRequest, env: Env) => {
    const sessionId = getSessionId(request);
    if (!sessionId) return new Response("Unauthorized", { status: 401 });

    const session = await getSession(env, sessionId);
    if (!session) return new Response("Unauthorized", { status: 401 });

    return Response.json({
      displayName: session.displayName,
      mail: session.mail,
    });
  });
}
