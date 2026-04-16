"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalSeconds = 30 }: { intervalSeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, Math.max(5, intervalSeconds) * 1000);
    return () => clearInterval(id);
  }, [intervalSeconds, router]);
  return null;
}
