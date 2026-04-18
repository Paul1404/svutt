"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "@/components/Icon";

type Props = {
  label: string;
  children: React.ReactNode;
  /** Visually hidden text for the trigger (e.g. "Was heißt Best of 5?"). */
  triggerLabel?: string;
  className?: string;
};

/**
 * Accessible help tooltip: a small "?" button. Opens on hover, focus, click,
 * and touch. Dismisses on Escape, outside click, or blur. Content is
 * announced via aria-describedby when the trigger is focused.
 */
export function HelpTooltip({
  label,
  children,
  triggerLabel,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label={triggerLabel ?? label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onMouseLeave={(e) => {
          // keep open if focus is inside
          if (
            !wrapRef.current?.contains(
              (e.relatedTarget as Node) ?? document.activeElement,
            )
          ) {
            setOpen(false);
          }
        }}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-400 hover:text-brand-600 hover:bg-brand-50 focus-visible:text-brand-600 transition-colors"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-ink-200 bg-white p-3 text-xs leading-relaxed text-ink-700 shadow-lift"
        >
          <span className="block font-semibold text-ink-900 mb-1">{label}</span>
          <span className="block">{children}</span>
        </span>
      )}
    </span>
  );
}
