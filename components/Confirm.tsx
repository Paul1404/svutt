"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, X } from "@/components/Icon";

type Variant = "default" | "danger";

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

type PendingRequest = ConfirmOptions & {
  id: number;
  resolve: (value: boolean) => void;
};

const ConfirmCtx = createContext<Ctx | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const nextId = useRef(1);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          // If a prior dialog is still open, reject the stale one so its
          // caller doesn't hang forever.
          prev?.resolve(false);
          return { ...opts, id: nextId.current++, resolve };
        });
      }),
    [],
  );

  const ctx = useMemo<Ctx>(() => ({ confirm }), [confirm]);

  const close = useCallback((value: boolean) => {
    setPending((prev) => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmCtx.Provider value={ctx}>
      {children}
      {pending && (
        <ConfirmDialog
          key={pending.id}
          request={pending}
          onClose={close}
        />
      )}
    </ConfirmCtx.Provider>
  );
}

function ConfirmDialog({
  request,
  onClose,
}: {
  request: PendingRequest;
  onClose: (value: boolean) => void;
}) {
  const {
    title,
    message,
    confirmLabel = "Bestätigen",
    cancelLabel = "Abbrechen",
    variant = "default",
  } = request;

  const confirmBtn = useRef<HTMLButtonElement | null>(null);
  const cancelBtn = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    // Give the cancel button focus by default - safer than confirm when a
    // user mashes Enter. Enter still works globally because the confirm
    // button is wired to it below.
    cancelBtn.current?.focus();

    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
      } else if (e.key === "Enter") {
        // Only trigger confirm via Enter when the user hasn't focused the
        // cancel button - matches how native dialogs behave.
        if (document.activeElement !== cancelBtn.current) {
          e.preventDefault();
          onClose(true);
        }
      } else if (e.key === "Tab") {
        // Tiny focus trap: cycle between cancel and confirm.
        const first = cancelBtn.current;
        const last = confirmBtn.current;
        if (!first || !last) return;
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const Icon = variant === "danger" ? AlertTriangle : Info;
  const iconWrap =
    variant === "danger"
      ? "bg-brand-50 text-brand-600"
      : "bg-ink-100 text-ink-600";
  const confirmCls =
    variant === "danger" ? "btn-danger" : "btn-primary";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`confirm-title-${request.id}`}
      aria-describedby={`confirm-body-${request.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
        onClick={() => onClose(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-surface shadow-lift">
        <button
          type="button"
          aria-label="Schließen"
          onClick={() => onClose(false)}
          className="absolute top-3 right-3 rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
        >
          <X size={16} />
        </button>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
            >
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id={`confirm-title-${request.id}`}
                className="font-semibold tracking-tight text-ink-900 text-base"
              >
                {title}
              </h2>
              <div
                id={`confirm-body-${request.id}`}
                className="mt-1 text-sm text-ink-700 leading-relaxed"
              >
                {message}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              ref={cancelBtn}
              type="button"
              className="btn-secondary"
              onClick={() => onClose(false)}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtn}
              type="button"
              className={confirmCls}
              onClick={() => onClose(true)}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
