import type { Context } from "hono";
import type { ZodSchema } from "zod";

export async function parseJson<T>(c: Context, schema: ZodSchema<T>): Promise<
  | { ok: true; data: T }
  | { ok: false; response: Response }
> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return {
      ok: false,
      response: c.json({ error: "Invalid JSON" }, 400),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        400,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function notFound(c: Context, entity = "Resource"): Response {
  return c.json({ error: `${entity} not found` }, 404);
}

export function conflict(c: Context, message: string): Response {
  return c.json({ error: message }, 409);
}
