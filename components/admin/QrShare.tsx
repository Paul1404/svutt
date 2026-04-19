"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Share } from "@/components/Icon";

export function QrShare({ slug }: { slug: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const base =
      (typeof window !== "undefined" && window.location.origin) ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "";
    const full = `${base}/t/${slug}`;
    setUrl(full);
    QRCode.toDataURL(full, {
      width: 400,
      margin: 1,
      color: { dark: "#b91c1c", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [slug]);

  if (!open) {
    return (
      <button
        className="btn-secondary btn-sm"
        onClick={() => setOpen(true)}
      >
        <Share size={14} /> Teilen
      </button>
    );
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="card w-full max-w-sm p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">
          Turnier teilen
        </div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">
          Auf Handy oder Leinwand zeigen
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          QR-Code scannen oder Link weitergeben.
        </p>

        {dataUrl && (
          <div className="mt-5 rounded-xl bg-white border border-ink-200 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="QR Code" className="mx-auto w-full" />
          </div>
        )}

        <div className="mt-4 rounded-lg bg-ink-50 border border-ink-200 px-3 py-2 text-xs text-ink-700 font-mono break-all">
          {url}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            className="btn-secondary flex-1"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Kopiert" : "Link kopieren"}
          </button>
          <button className="btn-primary flex-1" onClick={() => setOpen(false)}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
