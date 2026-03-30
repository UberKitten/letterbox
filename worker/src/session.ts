import type { Env } from "./env";

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)session=([a-f0-9]{64})/);
  return match ? match[1] : null;
}

export function sessionCookie(
  sessionId: string,
  origin: string,
  maxAge = SESSION_TTL,
): string {
  const isLocalhost = origin.includes("localhost");
  const parts = [
    `session=${sessionId}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (!isLocalhost) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(origin: string): string {
  return sessionCookie("deleted", origin, 0);
}

export interface SessionData {
  userId: string;
  displayName: string;
  mail: string;
  encryptedRefreshToken: string;
  accessToken?: string;
  accessTokenExpiry?: number;
}

export async function getSession(
  env: Env,
  sessionId: string,
): Promise<SessionData | null> {
  const raw = await env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function saveSession(
  env: Env,
  sessionId: string,
  data: SessionData,
): Promise<void> {
  await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(data), {
    expirationTtl: SESSION_TTL,
  });
}

export async function deleteSession(
  env: Env,
  sessionId: string,
): Promise<void> {
  await env.SESSIONS.delete(`session:${sessionId}`);
}
