import type { IRequest } from "itty-router";
import type { Env } from "./env";
import type { SessionData } from "./session";
import { getSessionId, getSession, saveSession } from "./session";
import { refreshAccessToken, encrypt } from "./tokens";

export async function withAuth(
  request: IRequest,
  env: Env,
): Promise<Response | undefined> {
  const sessionId = getSessionId(request as unknown as Request);
  if (!sessionId) return new Response("Unauthorized", { status: 401 });

  const session = await getSession(env, sessionId);
  if (!session) return new Response("Unauthorized", { status: 401 });

  if (session.accessToken && session.accessTokenExpiry && Date.now() < session.accessTokenExpiry) {
    request.session = session;
    request.sessionId = sessionId;
    request.accessToken = session.accessToken;
    return undefined;
  }

  try {
    const refreshed = await refreshAccessToken(
      session.encryptedRefreshToken,
      env,
    );

    const encryptedRefresh = await encrypt(
      refreshed.refreshToken,
      env.TOKEN_ENCRYPTION_KEY,
    );

    session.accessToken = refreshed.accessToken;
    session.accessTokenExpiry = Date.now() + refreshed.expiresIn * 1000 - 60000;
    session.encryptedRefreshToken = encryptedRefresh;

    await saveSession(env, sessionId, session);

    request.session = session;
    request.sessionId = sessionId;
    request.accessToken = refreshed.accessToken;
    return undefined;
  } catch {
    return new Response("Session expired, please login again", { status: 401 });
  }
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}
