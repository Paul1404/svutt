import Link from "next/link";
import type { ReactNode } from "react";
import { ClubMark } from "@/components/ClubMark";
import { ArrowLeft } from "@/components/Icon";

type MetaItem = {
  icon?: ReactNode;
  label: ReactNode;
  key?: string;
};

type Variant = "hero" | "compact";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: MetaItem[];
  backHref?: string;
  backLabel?: string;
  badge?: ReactNode;
  trailing?: ReactNode;
  variant?: Variant;
  sticky?: boolean;
  maxWidthClass?: string;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  backHref,
  backLabel,
  badge,
  trailing,
  variant = "hero",
  sticky = false,
  maxWidthClass = "max-w-4xl",
}: PageHeaderProps) {
  const isCompact = variant === "compact";
  const padding = isCompact ? "py-4 sm:py-5" : "py-12 sm:py-16";
  const titleSize = isCompact
    ? "text-xl sm:text-2xl"
    : "text-3xl sm:text-5xl";
  const eyebrowSize = isCompact ? "text-[10px]" : "text-[10px] sm:text-xs";
  const logoSize = isCompact ? "md" : "lg";

  return (
    <header
      className={[
        "relative isolate overflow-hidden text-white",
        sticky ? "sticky top-0 z-10" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background:
          "linear-gradient(135deg, #7f1d1d 0%, #991b1b 22%, #b91c1c 55%, #dc2626 100%)",
        boxShadow:
          "0 10px 30px -12px rgb(127 29 29 / 0.45), inset 0 -1px 0 rgb(255 255 255 / 0.08)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 80% at 100% 0%, rgba(255,255,255,0.22) 0%, transparent 60%), radial-gradient(45% 70% at 0% 100%, rgba(255,255,255,0.10) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent)",
        }}
      />

      <div className={`relative mx-auto ${maxWidthClass} px-4 ${padding}`}>
        {(backHref || trailing !== null) && (
          <div className="flex items-center justify-between gap-4">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-50/90 hover:text-white transition-colors min-w-0"
              >
                <ArrowLeft size={14} />
                <span className="truncate">{backLabel ?? "Zurück"}</span>
              </Link>
            ) : (
              <span aria-hidden />
            )}
            {trailing !== undefined ? (
              trailing
            ) : (
              <ClubMark size={logoSize} showLabel={false} />
            )}
          </div>
        )}

        <div className={isCompact ? "mt-2" : "mt-8 sm:mt-10"}>
          {eyebrow && (
            <div
              className={`font-bold uppercase tracking-[0.24em] text-brand-100/90 ${eyebrowSize}`}
            >
              {eyebrow}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1
              className={`font-bold tracking-tight ${titleSize} drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]`}
            >
              {title}
            </h1>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>
          {subtitle && (
            <p
              className={`mt-3 max-w-2xl text-brand-50/90 ${
                isCompact ? "text-sm" : "text-sm sm:text-base"
              }`}
            >
              {subtitle}
            </p>
          )}
          {meta && meta.length > 0 && (
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 ${
                isCompact ? "mt-2" : "mt-4"
              }`}
            >
              {meta.map((item, idx) => (
                <span
                  key={item.key ?? idx}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm"
                >
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
