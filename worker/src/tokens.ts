import type { Env } from "./env";

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", hash, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  plaintext: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(
  encrypted: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPES = "Mail.ReadWrite User.Read offline_access";

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  env: Env,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  encryptedRefreshToken: string,
  env: Env,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const refreshToken = await decrypt(
    encryptedRefreshToken,
    env.TOKEN_ENCRYPTION_KEY,
  );

  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data: TokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
