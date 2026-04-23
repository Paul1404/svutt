"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/db/schema";
import { Sparkles } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type Props = {
  category: Category;
};

export function TestPopulatePanel({ category }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function populateOnce(): Promise<number> {
    const res = await fetch(
      `/api/categories/${category.id}/populate-test-results`,
      { method: "POST" },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Fehler beim Befüllen.");
    }
    return typeof data.filled === "number" ? data.filled : 0;
  }

  async function buildBracket(): Promise<boolean> {
    const res = await fetch(`/api/categories/${category.id}/bracket`, {
      method: "POST",
    });
    return res.ok;
  }

  async function run() {
    if (
      !confirm(
        "Alle noch offenen Spiele dieser Spielklasse werden mit Zufallsergebnissen befüllt. Weiter?",
      )
    )
      return;
    setError(null);
    setLoading(true);
    try {
      let filled = await populateOnce();
      // For groups → KO, auto-build the bracket once groups are complete,
      // then fill the KO rounds in a second pass.
      if (category.structure === "groups_ko") {
        const built = await buildBracket();
        if (built) filled += await populateOnce();
      }
      toast.show({
        message:
          filled > 0
            ? `${filled} Spiele mit Testdaten befüllt.`
            : "Keine offenen Spiele zum Befüllen gefunden.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-amber-900">
              Testdaten befüllen
            </h3>
            <p className="mt-0.5 text-xs text-amber-800/80">
              Nur zum schnellen Ausprobieren: Alle offenen Spiele erhalten
              zufällige, regelkonforme Ergebnisse. Bei „Gruppen → KO“ wird der
              Finalbaum zusätzlich automatisch aufgebaut und gespielt.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Wird befüllt..." : "Ergebnisse zufällig füllen"}
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {error}
        </div>
      )}
    </section>
  );
}
