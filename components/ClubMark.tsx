import Image from "next/image";
import Link from "next/link";

type Size = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<
  Size,
  { box: string; img: number; gap: string; label: string }
> = {
  sm: { box: "h-9 w-9", img: 36, gap: "gap-2", label: "text-sm" },
  md: { box: "h-12 w-12", img: 48, gap: "gap-2.5", label: "text-base" },
  lg: { box: "h-16 w-16", img: 64, gap: "gap-3", label: "text-lg" },
  xl: { box: "h-20 w-20", img: 80, gap: "gap-3.5", label: "text-xl" },
};

export function ClubMark({
  size = "md",
  href,
  showLabel = true,
  labelClassName,
}: {
  size?: Size;
  href?: string;
  showLabel?: boolean;
  labelClassName?: string;
}) {
  const cfg = sizeMap[size];
  const inner = (
    <span className={`inline-flex items-center ${cfg.gap}`}>
      <span
        className={`relative inline-flex ${cfg.box} items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-ink-200 shadow-soft`}
      >
        <Image
          src="/logo.png"
          alt="SV 1945 Untereuerheim e.V. — Vereinslogo"
          width={cfg.img}
          height={cfg.img}
          priority
        />
      </span>
      {showLabel && (
        <span
          className={`font-semibold tracking-tight ${cfg.label} ${labelClassName ?? ""}`}
        >
          SV Untereuerheim
        </span>
      )}
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {inner}
      </Link>
    );
  }
  return inner;
}
