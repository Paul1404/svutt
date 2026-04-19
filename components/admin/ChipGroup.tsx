"use client";

export type ChipOption<T extends number | string> = {
  value: T;
  label: string;
};

export function ChipGroup<T extends number | string>({
  options,
  value,
  onChange,
  disabled,
  allowCustom,
  customMin,
  customMax,
  customLabel,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  allowCustom?: boolean;
  customMin?: number;
  customMax?: number;
  customLabel?: string;
}) {
  const isCustom = allowCustom && !options.some((o) => o.value === value);
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5 items-center">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-ink-200 bg-surface text-ink-700 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      {allowCustom && (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-2 py-1">
          <span className="text-xs text-ink-500">
            {customLabel ?? "Andere"}:
          </span>
          <input
            type="number"
            min={customMin}
            max={customMax}
            disabled={disabled}
            value={isCustom ? value : ""}
            placeholder="—"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange(n as T);
            }}
            className="w-14 bg-transparent text-sm font-semibold tabular-nums outline-none disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
