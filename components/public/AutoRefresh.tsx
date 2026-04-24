"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "connecting" | "live" | "polling";

/**
 * Streams live update hints from the server over SSE and triggers a
 * router.refresh() whenever the category revision bumps. When the stream
 * is unavailable (proxy issues, offline, initial load) we fall back to the
 * old periodic polling so the page still catches up eventually.
 */
export function AutoRefresh({
  streamUrl,
  fallbackSeconds = 30,
}: {
  streamUrl?: string;
  fallbackSeconds?: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    streamUrl ? "connecting" : "polling",
  );
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!streamUrl || typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    const es = new EventSource(streamUrl);
    let closed = false;
    let seenHello = false;

    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    es.addEventListener("hello", () => {
      if (closed) return;
      seenHello = true;
      setStatus("live");
    });
    es.addEventListener("revision", () => {
      if (closed) return;
      refresh();
    });
    es.onerror = () => {
      if (closed) return;
      // EventSource auto-reconnects; flip to the polling badge so users
      // understand the feed is temporarily degraded.
      if (seenHello) setStatus("connecting");
      else setStatus("polling");
    };

    return () => {
      closed = true;
      es.close();
    };
  }, [streamUrl, router]);

  useEffect(() => {
    // Fallback polling. Runs at a slow cadence regardless of SSE state so
    // we eventually catch events that were missed while disconnected.
    const id = setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        // When SSE is healthy we still do a sanity-refresh — cheap and
        // prevents cache-staleness from ever getting weird.
        if (statusRef.current === "live") return;
        router.refresh();
      },
      Math.max(5, fallbackSeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [fallbackSeconds, router]);

  return null;
}
