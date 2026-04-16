import type { MiddlewareHandler } from "hono";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const cookieHeader = c.req.header("cookie") ?? "";
  const token = parseCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const session = await verifySession(token);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", session.sub);
  await next();
};

function parseCookie(header: string, name: string): string | null {
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}
