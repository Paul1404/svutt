// Tiny in-process pub/sub for live result updates. Admins mutate data
// (result entered, draw done, bracket built, ...) and push a "revision"
// event into a per-category bus; public SSE clients are subscribed and get
// told to re-fetch. There is no persistence — if the server restarts every
// client just reconnects and keeps polling the HTTP fallback.
//
// Designed for the single-instance Railway deployment this project actually
// runs on. In a multi-instance world you would swap this for Redis pub/sub
// or a managed queue.

import { EventEmitter } from "node:events";

type LiveListener = (revision: number) => void;

declare global {
  // eslint-disable-next-line no-var
  var __svutt_live__:
    | {
        bus: EventEmitter;
        revisions: Map<string, number>;
      }
    | undefined;
}

function state() {
  if (!globalThis.__svutt_live__) {
    const bus = new EventEmitter();
    // Each SSE client registers one listener per connection. The cap is
    // generous enough that Node stops warning us — the real backpressure
    // comes from browsers limiting open connections to the same origin.
    bus.setMaxListeners(1000);
    globalThis.__svutt_live__ = {
      bus,
      revisions: new Map(),
    };
  }
  return globalThis.__svutt_live__;
}

/**
 * Bump the revision for a category and notify every connected subscriber.
 * Safe to call from any admin route — never throws even if nothing is
 * listening.
 */
export function publishCategoryRevision(categoryId: string): number {
  const s = state();
  const next = (s.revisions.get(categoryId) ?? 0) + 1;
  s.revisions.set(categoryId, next);
  s.bus.emit(`cat:${categoryId}`, next);
  return next;
}

export function currentCategoryRevision(categoryId: string): number {
  return state().revisions.get(categoryId) ?? 0;
}

export function subscribeCategory(
  categoryId: string,
  listener: LiveListener,
): () => void {
  const s = state();
  const event = `cat:${categoryId}`;
  s.bus.on(event, listener);
  return () => {
    s.bus.off(event, listener);
  };
}
