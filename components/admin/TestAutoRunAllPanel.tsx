"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type CategoryInfo = {
  id: string;
  name: string;
  structure: string;
  drawDone: boolean;
  bracketDone: boolean;
};

type Props = {
  categories: CategoryInfo[];
};

type Stage = "group" | "ko" | "swiss";

async function populateOnce(id: string, stage?: Stage): Promise<number> {
  const url = stage
    ? `/api/categories/${id}/populate-test-results?stage=${stage}`
    : `/api/categories/${id}/populate-test-results`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Fehler beim Befüllen.");
  return typeof data.filled === "number" ? data.filled : 0;
}

async function drawCategory(id: string): Promise<void> {
  const res = await fetch(`/api/categories/${id}/draw`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Auslosung fehlgeschlagen.");
}

async function buildBracket(id: string): Promise<void> {
  await fetch(`/api/categories/${id}/bracket`, { method: "POST" });
}

async function planNextSwissRound(id: string): Promise<boolean> {
  const res = await fetch(`/api/categories/${id}/swiss/round`, {
    method: "POST",
  });
  return res.ok;
}

async function runOne(cat: CategoryInfo): Promise<number> {
  let filled = 0;
  if (!cat.drawDone) await drawCategory(cat.id);

  if (cat.structure === "swiss") {
    for (let i = 0; i < 32; i++) {
      filled += await populateOnce(cat.id, "swiss");
      const planned = await planNextSwissRound(cat.id);
      if (!planned) break;
    }
  } else if (cat.structure === "groups_ko") {
    filled += await populateOnce(cat.id, "group");
    await buildBracket(cat.id);
    filled += await populateOnce(cat.id, "ko");
  } else {
    filled += await populateOnce(cat.id);
  }
  return filled;
}

export function TestAutoRunAllPanel({ categories }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) return null;

  async function runAll() {
    if (
      !confirm(
        `Alle ${categories.length} Spielklassen werden komplett mit Zufallsergebnissen durchgespielt. Weiter?`,
      )
    )
      return;
    setError(null);
    setStatus(null);
    setLoading(true);
    let total = 0;
    const failures: string[] = [];
    try {
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i]!;
        setStatus(
          `(${i + 1}/${categories.length}) ${cat.name} wird durchgespielt…`,
        );
        try {
          total += await runOne(cat);
        } catch (err) {
          failures.push(
            `${cat.name}: ${err instanceof Error ? err.message : "Fehler"}`,
          );
        }
      }
      toast.show({
        message:
          failures.length === 0
            ? `${total} Spiele in ${categories.length} Spielklassen befüllt.`
            : `${total} Spiele befüllt, ${failures.length} Spielklasse(n) mit Fehlern.`,
        variant: failures.length === 0 ? "success" : "info",
      });
      if (failures.length > 0) setError(failures.join("\n"));
      router.refresh();
    } finally {
      setStatus(null);
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
              Ganzes Turnier durchspielen
            </h3>
            <p className="mt-0.5 text-xs text-amber-800/80">
              Lost alle Spielklassen aus, befüllt sämtliche Spiele mit
              zufälligen Ergebnissen und baut Finalbäume automatisch auf. Nur
              zum Testen.
            </p>
            {status && loading && (
              <p className="mt-1 text-xs text-amber-800">{status}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={runAll}
          disabled={loading}
        >
          {loading ? "Wird befüllt…" : "Alles durchspielen"}
        </button>
      </div>
      {error && (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700">
          {error}
        </pre>
      )}
    </section>
  );
}
