import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "svutt_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string; // username
  iat: number;
  exp: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET env var must be set (at least 16 characters).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .setSubject(username)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export function verifyAdminCredentials(
  username: string,
  password: string,
): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) return false;
  // Constant-time compare to avoid timing side-channel.
  if (username !== expectedUser) return false;
  if (password.length !== expectedPass.length) return false;
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ expectedPass.charCodeAt(i);
  }
  return diff === 0;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
