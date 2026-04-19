"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "./Icon";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("svutt-theme", next);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label =
    theme === "dark" ? "Helles Design aktivieren" : "Dunkles Design aktivieren";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-surface text-ink-600 transition-colors hover:text-brand-600 hover:border-ink-300 ${className}`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      suppressHydrationWarning
    >
      {mounted && theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
