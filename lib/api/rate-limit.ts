import type { Context } from "hono";

// In-memory fixed-window rate limiter. Good enough for a single-instance
// deployment (Railway runs one app container). If this ever scales to
// multiple instances, move the bucket store to Postgres or Redis.

type Entry = { count: number; firstAt: number };

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const failures = new Map<string, Entry>();

export type RateLimitState = { limited: boolean; retryAfterSeconds: number };

function prune(now: number): void {
  for (const [key, entry] of failures) {
    if (now - entry.firstAt >= WINDOW_MS) failures.delete(key);
  }
}

/** Read-only check: is this key currently locked out? */
export function isRateLimited(key: string): RateLimitState {
  const entry = failures.get(key);
  if (!entry) return { limited: false, retryAfterSeconds: 0 };

  const now = Date.now();
  if (now - entry.firstAt >= WINDOW_MS) {
    failures.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil(
      (entry.firstAt + WINDOW_MS - now) / 1000,
    );
    return { limited: true, retryAfterSeconds };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

/** Record one failed attempt against the key. */
export function recordFailure(key: string): void {
  const now = Date.now();
  if (failures.size > 1000) prune(now);

  const entry = failures.get(key);
  if (!entry || now - entry.firstAt >= WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
}

/** Clear the key, e.g. after a successful login. */
export function resetFailures(key: string): void {
  failures.delete(key);
}

/**
 * Best-effort client IP. Behind Railway/Next the real address arrives in
 * `x-forwarded-for`; fall back to `x-real-ip`, then a shared bucket so a
 * missing header still rate-limits rather than bypassing the check.
 */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() ?? "unknown";
}

// Exposed for tests.
export const RATE_LIMIT_MAX_ATTEMPTS = MAX_ATTEMPTS;
