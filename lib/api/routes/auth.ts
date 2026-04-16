import { Hono } from "hono";
import {
  SESSION_COOKIE_NAME,
  signSession,
  verifyAdminCredentials,
} from "@/lib/auth/session";
import { loginSchema } from "@/lib/validators";
import { parseJson } from "../helpers";

export const authRoutes = new Hono()
  .post("/login", async (c) => {
    const parsed = await parseJson(c, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { username, password } = parsed.data;

    if (!verifyAdminCredentials(username, password)) {
      return c.json({ error: "Falsche Zugangsdaten." }, 401);
    }

    const token = await signSession(username);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    c.header(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`,
    );
    return c.json({ ok: true, user: { username } });
  })
  .post("/logout", async (c) => {
    c.header(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    );
    return c.json({ ok: true });
  });
