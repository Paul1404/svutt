import { Hono } from "hono";
import { currentAdminRevision, subscribeAdmin } from "@/lib/live";

// Admin-side live stream. Mirrors the public SSE endpoint in shape so the
// client component can reuse the same EventSource pattern. Scope is global
// (all tournaments / categories) - there is only one admin user, with at
// most a couple of devices, so a single shared revision counter is enough
// and the occasional cross-tournament refresh is cheap.
export const adminRoutes = new Hono().get("/live", async (c) => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("hello", String(currentAdminRevision()));

      const unsubscribe = subscribeAdmin((revision) => {
        send("revision", String(revision));
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 25_000);

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      c.req.raw.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
});
