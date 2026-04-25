"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Participant } from "@/lib/db/schema";
import { X } from "@/components/Icon";

type Props = {
  participants: Participant[];
};

export function PlayerSearchPalette({ participants }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const isMac = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/i.test(navigator.platform),
    [],
  );

  // Folded versions for case- and diacritic-insensitive substring search.
  const folded = useMemo(
    () =>
      participants.map((p) => ({
        p,
        haystack: foldText(`${p.name} ${p.club ?? ""}`),
      })),
    [participants],
  );

  const results = useMemo(() => {
    const q = foldText(query.trim());
    const list = q
      ? folded
          .filter((it) => it.haystack.includes(q))
          .map((it) => it.p)
      : participants;
    return list.slice(0, 50);
  }, [folded, participants, query]);

  // Reset selection when the result set shrinks/changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Global Cmd/Ctrl+K opens the palette - matches the convention used
  // across Linear, Notion, GitHub. Works even when an input is focused
  // so the admin can always reach for it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    // Focus the input after the modal mounts.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Keep the active row visible as the user arrows through the list.
  useEffect(() => {
    if (!open) return;
    const li = listRef.current?.querySelector<HTMLLIElement>(
      `[data-idx="${activeIdx}"]`,
    );
    li?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open, results.length]);

  const close = useCallback(() => setOpen(false), []);

  const select = useCallback(
    (participantId: string) => {
      setOpen(false);
      // Defer scroll until after the modal unmounts so layout settles
      // (the palette locks body overflow which can shift positions).
      requestAnimationFrame(() => {
        const el = document.getElementById(playerAnchorId(participantId));
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("player-search-hit");
        window.setTimeout(
          () => el.classList.remove("player-search-hit"),
          1800,
        );
      });
    },
    [],
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[activeIdx];
      if (hit) select(hit.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-xs text-ink-600 shadow-soft hover:border-ink-300 hover:bg-surface-2 transition-colors"
        aria-label="Spieler suchen"
        title="Spieler suchen"
      >
        <SearchIcon />
        <span>Spieler suchen</span>
        <span className="hidden sm:inline-flex items-center gap-0.5">
          <kbd className="kbd">{isMac ? "⌘" : "Strg"}</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Spieler suchen"
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          >
            <div
              className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
              onClick={close}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-lg rounded-2xl border border-ink-200 bg-surface shadow-lift overflow-hidden">
              <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
                <SearchIcon />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder="Name oder Verein..."
                  aria-label="Suchbegriff"
                  aria-autocomplete="list"
                  aria-controls="player-search-results"
                  aria-activedescendant={
                    results[activeIdx]
                      ? `player-search-opt-${results[activeIdx]!.id}`
                      : undefined
                  }
                  className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Schließen"
                  className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <ul
                ref={listRef}
                id="player-search-results"
                role="listbox"
                className="max-h-[50vh] overflow-y-auto py-1"
              >
                {results.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-ink-500">
                    Keine Treffer.
                  </li>
                ) : (
                  results.map((p, i) => {
                    const active = i === activeIdx;
                    return (
                      <li
                        key={p.id}
                        id={`player-search-opt-${p.id}`}
                        data-idx={i}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => select(p.id)}
                        className={`cursor-pointer px-4 py-2 text-sm flex items-center justify-between gap-3 ${
                          active ? "bg-brand-50 text-brand-900" : "text-ink-800"
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {p.name}
                        </span>
                        {p.club && (
                          <span
                            className={`shrink-0 truncate text-xs ${
                              active ? "text-brand-700" : "text-ink-500"
                            }`}
                          >
                            {p.club}
                          </span>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>

              <div className="flex items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/50 px-4 py-2 text-[11px] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <kbd className="kbd">↑</kbd>
                  <kbd className="kbd">↓</kbd>
                  navigieren
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="kbd">↵</kbd>
                  springen
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="kbd">Esc</kbd>
                  schließen
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function playerAnchorId(participantId: string) {
  return `player-row-${participantId}`;
}

function foldText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function SearchIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-ink-400"
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
