"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, Undo, X, AlertTriangle } from "@/components/Icon";

type Variant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: Variant;
  undo?: () => Promise<void> | void;
  undoLabel?: string;
  ttl: number;
};

type ShowArgs = {
  message: string;
  variant?: Variant;
  undo?: () => Promise<void> | void;
  undoLabel?: string;
  ttl?: number;
};

type Ctx = {
  show: (args: ShowArgs) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const show = useCallback(
    ({ message, variant = "success", undo, undoLabel, ttl = 5000 }: ShowArgs) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, message, variant, undo, undoLabel, ttl }]);
    },
    [],
  );

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div
        role="region"
        aria-label="Benachrichtigungen"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={() => remove(item.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    const t = setTimeout(onDismiss, item.ttl);
    return () => clearTimeout(t);
  }, [item.ttl, onDismiss]);

  const variantCls =
    item.variant === "error"
      ? "border-brand-200 bg-surface text-brand-900"
      : item.variant === "info"
        ? "border-ink-200 bg-surface text-ink-900"
        : "border-emerald-200 bg-surface text-ink-900";

  const Icon =
    item.variant === "error"
      ? AlertTriangle
      : item.variant === "info"
        ? AlertTriangle
        : Check;
  const iconColor =
    item.variant === "error"
      ? "text-brand-600"
      : item.variant === "info"
        ? "text-ink-500"
        : "text-emerald-600";

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 shadow-lift flex items-center gap-3 ${variantCls}`}
    >
      <span className={iconColor}>
        <Icon size={18} />
      </span>
      <span className="flex-1 text-sm">{item.message}</span>
      {item.undo && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-surface px-2.5 py-1 text-xs font-semibold text-ink-800 hover:border-brand-300 hover:text-brand-700 transition-colors disabled:opacity-50"
          disabled={undoing}
          onClick={async () => {
            if (!item.undo) return;
            setUndoing(true);
            try {
              await item.undo();
            } finally {
              setUndoing(false);
              onDismiss();
            }
          }}
        >
          <Undo size={12} />
          {undoing ? "Mache rückgängig..." : (item.undoLabel ?? "Rückgängig")}
        </button>
      )}
      <button
        type="button"
        aria-label="Schließen"
        className="text-ink-400 hover:text-ink-700"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}
