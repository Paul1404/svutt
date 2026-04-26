import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  description:
    "Diese Seite gibt es nicht oder sie wurde verschoben. Zurück zur Turnierübersicht.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-page">
      <PageHeader
        eyebrow="Fehler 404"
        title="Seite nicht gefunden"
        subtitle="Diese Seite gibt es nicht oder sie wurde verschoben. Vielleicht wurde der Link falsch abgetippt oder das Turnier ist inzwischen offline."
      />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-2xl px-4 pt-10 pb-16 sm:pt-12 sm:pb-24"
      >
        <section className="card p-8 text-center">
          <div
            aria-hidden
            className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70"
          >
            <span className="text-2xl font-black tabular-nums tracking-tight">
              404
            </span>
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink-900">
            Hier ist nichts zu sehen
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            Bitte prüfe die Adresse oder kehre zur Übersicht zurück.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              Zur Turnierübersicht
              <ArrowRight size={14} />
            </Link>
            <Link href="/admin" className="btn-secondary">
              Organisator-Bereich
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
