"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, EyeOff } from "@/components/Icon";
import { useToast } from "@/components/Toast";

export function PublishToggle({
  categoryId,
  published,
}: {
  categoryId: string;
  published: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.show({
          message: data.error ?? "Umschalten hat nicht geklappt.",
          variant: "error",
        });
        return;
      }
      toast.show({
        message: !published
          ? "Spielklasse ist jetzt öffentlich sichtbar."
          : "Spielklasse ist jetzt wieder als Entwurf versteckt.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    return (
      <div className="card p-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="text-emerald-600 mt-0.5">
            <Check size={18} />
          </span>
          <div>
            <div className="font-semibold tracking-tight text-ink-900">
              Öffentlich sichtbar
            </div>
            <p className="mt-0.5 text-sm text-ink-500">
              Diese Spielklasse erscheint auf der öffentlichen Turnierseite.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          onClick={toggle}
          disabled={busy}
        >
          <EyeOff size={14} />
          {busy ? "Verstecke..." : "Als Entwurf verstecken"}
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4 flex items-start justify-between gap-4 flex-wrap border-amber-200 bg-amber-50/60">
      <div className="flex items-start gap-3">
        <span className="text-amber-700 mt-0.5">
          <EyeOff size={18} />
        </span>
        <div>
          <div className="font-semibold tracking-tight text-amber-900">
            Entwurf - noch nicht öffentlich
          </div>
          <p className="mt-0.5 text-sm text-amber-900/80">
            Nur Admins sehen diese Spielklasse. Auf der öffentlichen
            Turnierseite wird sie ausgeblendet, bis du sie freischaltest.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="btn-primary btn-sm inline-flex items-center gap-1.5"
        onClick={toggle}
        disabled={busy}
      >
        <Eye size={14} />
        {busy ? "Veröffentliche..." : "Veröffentlichen"}
      </button>
    </div>
  );
}
