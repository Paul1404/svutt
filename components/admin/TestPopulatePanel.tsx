"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/db/schema";
import { Sparkles } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";

type Props = {
  category: Category;
  participantCount: number;
};

type Stage = "group" | "ko" | "ko_losers" | "swiss";

export function TestPopulatePanel({ category, participantCount }: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const structure = category.structure;
  const minCount = structure === "groups_ko" ? 4 : 2;
  const canRun = participantCount >= minCount;

  async function populateOnce(stage?: Stage): Promise<number> {
    const url = stage
      ? `/api/categories/${category.id}/populate-test-results?stage=${stage}`
      : `/api/categories/${category.id}/populate-test-results`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Fehler beim Befüllen.");
    return typeof data.filled === "number" ? data.filled : 0;
  }

  async function drawCategory(): Promise<void> {
    const res = await fetch(`/api/categories/${category.id}/draw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Auslosung fehlgeschlagen.");
  }

  async function buildBracket(): Promise<boolean> {
    const res = await fetch(`/api/categories/${category.id}/bracket`, {
      method: "POST",
    });
    return res.ok;
  }

  async function planNextSwissRound(): Promise<boolean> {
    const res = await fetch(`/api/categories/${category.id}/swiss/round`, {
      method: "POST",
    });
    return res.ok;
  }

  async function runAll() {
    const ok = await confirm({
      title: "Turnier durchspielen",
      message:
        "Die Auslosung läuft und alle Spiele (inkl. Finalbaum) werden mit Zufallsergebnissen befüllt. Gedacht für Trainings- und Demo-Runs.",
      confirmLabel: "Durchspielen",
      variant: "danger",
    });
    if (!ok) return;
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      let filled = 0;

      if (!category.drawDone) {
        setStatus("Losung läuft…");
        await drawCategory();
      }

      if (structure === "swiss") {
        // Fill current round, plan the next, repeat until no more rounds.
        for (let i = 0; i < 32; i++) {
          setStatus(`Runde ${i + 1}: Ergebnisse werden gefüllt…`);
          filled += await populateOnce("swiss");
          const planned = await planNextSwissRound();
          if (!planned) break;
        }
      } else if (structure === "groups_ko") {
        setStatus("Gruppenspiele werden gefüllt…");
        filled += await populateOnce("group");
        setStatus("Finalbaum wird aufgebaut…");
        await buildBracket();
        setStatus("KO-Spiele werden gefüllt…");
        filled += await populateOnce("ko");
        setStatus("Trostrunde wird gefüllt…");
        filled += await populateOnce("ko_losers");
      } else {
        // round_robin, ko_only: single stage, fill everything.
        setStatus("Ergebnisse werden gefüllt…");
        filled += await populateOnce();
      }

      toast.show({
        message:
          filled > 0
            ? `Turnier durchgespielt: ${filled} Spiele mit Testdaten befüllt.`
            : "Keine offenen Spiele zum Befüllen gefunden.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setStatus(null);
      setLoading(false);
    }
  }

  async function runGroupsOnly() {
    const ok = await confirm({
      title: "Gruppenspiele befüllen",
      message:
        "Alle noch offenen Gruppenspiele werden mit Zufallsergebnissen befüllt. Der Finalbaum bleibt unberührt.",
      confirmLabel: "Befüllen",
      variant: "danger",
    });
    if (!ok) return;
    setError(null);
    setLoading(true);
    try {
      const filled = await populateOnce("group");
      toast.show({
        message:
          filled > 0
            ? `${filled} Gruppenspiele mit Testdaten befüllt.`
            : "Keine offenen Gruppenspiele zum Befüllen gefunden.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  const showGroupsOnly = structure === "groups_ko" && category.drawDone;
  const primaryLabel = category.drawDone
    ? "Ergebnisse zufällig füllen"
    : "Komplettes Turnier durchspielen";

  return (
    <section className="card border-dashed p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold tracking-tight text-ink-900">
                Testdaten befüllen
              </h3>
              <span className="badge-amber">Nur zum Testen</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {category.drawDone
                ? "Alle offenen Spiele erhalten zufällige, regelkonforme Ergebnisse. Bei „Gruppen → KO“ wird der Finalbaum zusätzlich automatisch aufgebaut und gespielt."
                : "Simuliert das gesamte Turnier in Sekunden: Auslosung, alle Spiele, Finalbaum – alles mit zufälligen, regelkonformen Ergebnissen."}
            </p>
            {!canRun && (
              <p className="mt-1 text-xs font-medium text-ink-700">
                Mindestens {minCount} Teilnehmer nötig.
              </p>
            )}
            {status && loading && (
              <p className="mt-1 text-xs text-ink-600">{status}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showGroupsOnly && (
            <button
              type="button"
              className="btn-secondary"
              onClick={runGroupsOnly}
              disabled={loading || !canRun}
            >
              Nur Gruppenphase befüllen
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={runAll}
            disabled={loading || !canRun}
          >
            {loading ? "Wird befüllt…" : primaryLabel}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {error}
        </div>
      )}
    </section>
  );
}
