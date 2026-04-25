"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribes to the admin SSE stream and triggers `router.refresh()` on each
 * `revision` event so a second admin device sees changes the first one made
 * without a manual reload. Mirrors the public-side AutoRefresh - same shape,
 * but global scope and admin-auth gated.
 *
 * Two-device safety: the SSE handshake reuses the existing `svutt_session`
 * cookie, both sessions are independent JWTs, both clients refresh in
 * response to the same admin revision counter. There is no cross-device
 * conflict resolution here - we just keep both views fresh.
 */
export function AdminAutoRefresh({
  fallbackSeconds = 30,
}: {
  fallbackSeconds?: number;
}) {
  const router = useRouter();
  const liveRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    const es = new EventSource("/api/admin/live");
    let closed = false;

    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    es.addEventListener("hello", () => {
      if (closed) return;
      liveRef.current = true;
    });
    es.addEventListener("revision", () => {
      if (closed) return;
      refresh();
    });
    es.onerror = () => {
      if (closed) return;
      liveRef.current = false;
    };

    return () => {
      closed = true;
      es.close();
    };
  }, [router]);

  useEffect(() => {
    // Polling fallback for when SSE is degraded (proxy issues, offline tab).
    // Skipped while the live feed is healthy so we don't double-refresh.
    const id = setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        if (liveRef.current) return;
        router.refresh();
      },
      Math.max(5, fallbackSeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [fallbackSeconds, router]);

  return null;
}
