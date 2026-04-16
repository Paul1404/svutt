"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrShare({ slug }: { slug: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const base =
      (typeof window !== "undefined" && window.location.origin) ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "";
    const full = `${base}/t/${slug}`;
    setUrl(full);
    QRCode.toDataURL(full, { width: 320, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [slug]);

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        QR-Code anzeigen
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-2">Public-View teilen</h3>
        <p className="text-sm text-slate-600 break-all mb-4">{url}</p>
        {dataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR Code" className="mx-auto" />
        )}
        <div className="flex gap-2 mt-4">
          <button
            className="btn-secondary flex-1"
            onClick={() => navigator.clipboard.writeText(url)}
          >
            URL kopieren
          </button>
          <button className="btn-primary flex-1" onClick={() => setOpen(false)}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
