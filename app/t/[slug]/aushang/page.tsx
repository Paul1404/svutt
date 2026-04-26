import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { PrintTrigger } from "@/components/public/PrintTrigger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
};

function publicUrl(slug: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
    "https://svutt.example";
  return `${base}/t/${slug}`;
}

export default async function PosterPage({ params }: Props) {
  const { slug } = await params;
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  if (!tournament) notFound();

  const url = publicUrl(slug);
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 800,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#b91c1c", light: "#ffffff" },
  });

  const dateStr = tournament.startDate
    ? new Date(tournament.startDate).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="poster-page">
      <PrintTrigger />

      <div className="poster-controls print:hidden">
        <a href={`/t/${slug}`} className="poster-back">
          ← Zurück zum Turnier
        </a>
        <button
          type="button"
          className="poster-print-btn"
          data-poster-print
        >
          Drucken / als PDF speichern
        </button>
      </div>

      <article className="poster-sheet">
        <header className="poster-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="SV 1945 Untereuerheim"
            className="poster-logo"
          />
          <div>
            <div className="poster-club">SV 1945 Untereuerheim e.V.</div>
            <div className="poster-section">Tischtennis-Abteilung</div>
          </div>
        </header>

        <div className="poster-eyebrow">Live-Spielplan und Tabellen</div>
        <h1 className="poster-title">{tournament.name}</h1>

        {(tournament.location || dateStr) && (
          <div className="poster-meta">
            {dateStr && <div className="poster-meta-row">{dateStr}</div>}
            {tournament.location && (
              <div className="poster-meta-row">{tournament.location}</div>
            )}
          </div>
        )}

        <div className="poster-qr-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR-Code für ${url}`} className="poster-qr" />
        </div>

        <div className="poster-howto">
          <div className="poster-howto-title">So funktioniert's</div>
          <ol className="poster-howto-list">
            <li>Mit dem Handy auf den QR-Code halten.</li>
            <li>
              Die Seite öffnet sich automatisch — keine App nötig, kein Login.
            </li>
            <li>
              Ergebnisse, Tabellen und der nächste Aufruf stehen hier live.
            </li>
          </ol>
        </div>

        <footer className="poster-footer">
          <div className="poster-url">{url}</div>
          <div className="poster-fineprint">
            Fragen? An den Organisator-Tisch wenden.
          </div>
        </footer>
      </article>

      <style>{`
        :root {
          color-scheme: light;
        }
        body, html {
          background: #f4f4f5;
        }
        .poster-page {
          min-height: 100vh;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #18181b;
        }
        .poster-controls {
          width: 100%;
          max-width: 720px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .poster-back {
          font-size: 14px;
          color: #71717a;
          text-decoration: none;
        }
        .poster-back:hover { color: #b91c1c; }
        .poster-print-btn {
          appearance: none;
          background: #b91c1c;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,.1);
        }
        .poster-print-btn:hover { background: #991b1b; }
        .poster-sheet {
          width: 100%;
          max-width: 720px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06);
          padding: 56px 56px 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          aspect-ratio: 210 / 297;
        }
        .poster-header {
          display: flex;
          align-items: center;
          gap: 14px;
          align-self: flex-start;
          text-align: left;
          padding-bottom: 24px;
          margin-bottom: 0;
          border-bottom: 1px solid #e4e4e7;
          width: 100%;
        }
        .poster-logo {
          width: 56px;
          height: 56px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .poster-club {
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.01em;
        }
        .poster-section {
          font-size: 13px;
          color: #71717a;
          margin-top: 2px;
        }
        .poster-eyebrow {
          margin-top: 36px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #b91c1c;
        }
        .poster-title {
          margin: 8px 0 0;
          font-size: 36px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.02em;
          max-width: 100%;
          text-wrap: balance;
        }
        .poster-meta {
          margin-top: 10px;
          color: #52525b;
          font-size: 16px;
          line-height: 1.5;
        }
        .poster-meta-row + .poster-meta-row { margin-top: 2px; }
        .poster-qr-wrap {
          margin-top: 32px;
          padding: 18px;
          background: white;
          border: 1px solid #e4e4e7;
          border-radius: 14px;
        }
        .poster-qr {
          width: 320px;
          height: 320px;
          display: block;
        }
        .poster-howto {
          margin-top: 28px;
          padding: 18px 22px;
          background: #fafafa;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          width: 100%;
          text-align: left;
        }
        .poster-howto-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #71717a;
        }
        .poster-howto-list {
          margin: 8px 0 0;
          padding-left: 22px;
          font-size: 14px;
          color: #27272a;
          line-height: 1.6;
        }
        .poster-footer {
          margin-top: auto;
          padding-top: 28px;
          width: 100%;
        }
        .poster-url {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 13px;
          color: #52525b;
          word-break: break-all;
        }
        .poster-fineprint {
          margin-top: 8px;
          font-size: 12px;
          color: #a1a1aa;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            background: white;
          }
          .poster-page {
            padding: 0;
            min-height: auto;
          }
          .poster-sheet {
            box-shadow: none;
            border-radius: 0;
            padding: 24mm 22mm;
            width: 210mm;
            max-width: 210mm;
            min-height: 297mm;
            aspect-ratio: auto;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
