"use client";

import { useEffect } from "react";

/**
 * Wires up the poster's print button: clicking the element marked with
 * `data-poster-print` calls `window.print()`, which lets the browser save
 * the page as PDF or send it to a real printer. The button itself is
 * server-rendered so the page works even without JS — only the click
 * handler needs the client.
 */
export function PrintTrigger() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-poster-print]")) {
        e.preventDefault();
        window.print();
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
