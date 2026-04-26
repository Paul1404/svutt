import type {
  Group,
  Match,
  MatchSetRow,
  Participant,
} from "@/lib/db/schema";
import { Trophy } from "@/components/Icon";
import { matchNumber } from "@/lib/matchLabel";

type Props = {
  matches: Match[];
  sets: MatchSetRow[];
  participants: Participant[];
  groups?: Group[];
};

type StageKey = "group" | "ko" | "ko_losers" | "swiss";

const STAGE_LABELS: Record<StageKey, string> = {
  group: "Gruppenphase",
  ko: "Finalrunde",
  ko_losers: "Trostrunde",
  swiss: "Schweizer Runden",
};

export function GameResults({ matches, sets, participants, groups }: Props) {
  // Exclude bye walkovers (one side was never filled): the lone player
  // auto-advances and nothing was actually played, so these shouldn't clutter
  // the "finished games" list or inflate the progress denominator.
  const playableMatches = matches.filter(
    (m) => m.participantAId !== null && m.participantBId !== null,
  );
  const finished = playableMatches.filter((m) => m.status === "finished");
  const playableTotal = playableMatches.length;

  const partsById = new Map(participants.map((p) => [p.id, p]));
  const groupsById = new Map((groups ?? []).map((g) => [g.id, g]));
  const setsByMatch = new Map<string, MatchSetRow[]>();
  for (const s of sets) {
    const arr = setsByMatch.get(s.matchId) ?? [];
    arr.push(s);
    setsByMatch.set(s.matchId, arr);
  }
  for (const arr of setsByMatch.values())
    arr.sort((a, b) => a.setNumber - b.setNumber);

  const byStage = new Map<StageKey, Match[]>();
  for (const m of finished) {
    const key = (m.stage as StageKey) ?? "group";
    const arr = byStage.get(key) ?? [];
    arr.push(m);
    byStage.set(key, arr);
  }

  const stageOrder: StageKey[] = ["group", "swiss", "ko", "ko_losers"];

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Spielergebnisse
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Übersicht aller abgeschlossenen Spiele.
            </p>
          </div>
        </div>
        <div className="text-sm text-ink-600">
          <span className="font-semibold tabular-nums">{finished.length}</span>
          <span className="text-ink-400">
            {" "}
            / {playableTotal} Spielen fertig
          </span>
        </div>
      </div>

      {finished.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 bg-surface p-10 text-center">
          <p className="text-sm text-ink-600">
            Noch keine Spiele abgeschlossen.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {stageOrder.map((stage) => {
            const stageMatches = byStage.get(stage);
            if (!stageMatches || stageMatches.length === 0) return null;

            const sections = buildSections(stage, stageMatches, groupsById);

            return (
              <div key={stage} className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                  <h3 className="font-semibold tracking-tight">
                    {STAGE_LABELS[stage]}
                  </h3>
                  <span className="text-xs text-ink-500 tabular-nums">
                    {stageMatches.length}{" "}
                    {stageMatches.length === 1 ? "Spiel" : "Spiele"}
                  </span>
                </div>
                <div className="divide-y divide-ink-100">
                  {sections.map((section) => (
                    <div key={section.key}>
                      {section.label && (
                        <div className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                          {section.label}
                        </div>
                      )}
                      <ul className="divide-y divide-ink-100">
                        {section.matches.map((m) => {
                          const a = partsById.get(m.participantAId ?? "");
                          const b = partsById.get(m.participantBId ?? "");
                          const winnerA =
                            m.winnerParticipantId === m.participantAId;
                          const winnerB =
                            m.winnerParticipantId === m.participantBId;
                          const matchSets = setsByMatch.get(m.id) ?? [];
                          const table = m.tableNumber;

                          return (
                            <li key={m.id} className="px-5 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 text-sm">
                                  <span
                                    className={
                                      winnerA
                                        ? "font-bold text-ink-900"
                                        : "text-ink-600"
                                    }
                                  >
                                    {a?.name ?? "?"}
                                  </span>
                                  <span className="text-ink-400 mx-1.5">
                                    gg.
                                  </span>
                                  <span
                                    className={
                                      winnerB
                                        ? "font-bold text-ink-900"
                                        : "text-ink-600"
                                    }
                                  >
                                    {b?.name ?? "?"}
                                  </span>
                                </div>
                                <span className="tabular-nums font-mono text-sm font-bold text-brand-700 shrink-0">
                                  {m.setsA}:{m.setsB}
                                </span>
                              </div>
                              {(matchSets.length > 0 ||
                                typeof table === "number" ||
                                matchNumber(m) !== null) && (
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono tabular-nums text-ink-500">
                                  {matchNumber(m) !== null && (
                                    <span>{matchNumber(m)}</span>
                                  )}
                                  {matchNumber(m) !== null &&
                                    typeof table === "number" && (
                                      <span className="text-ink-300">·</span>
                                    )}
                                  {typeof table === "number" && (
                                    <span>T{table}</span>
                                  )}
                                  {matchSets.length > 0 &&
                                    (typeof table === "number" ||
                                      matchNumber(m) !== null) && (
                                      <span className="text-ink-300">·</span>
                                    )}
                                  {matchSets.length > 0 && (
                                    <span>
                                      {matchSets
                                        .map((s) => `${s.pointsA}:${s.pointsB}`)
                                        .join(", ")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

type Section = {
  key: string;
  label: string | null;
  matches: Match[];
};

function buildSections(
  stage: StageKey,
  stageMatches: Match[],
  groupsById: Map<string, Group>,
): Section[] {
  if (stage === "group") {
    const byGroup = new Map<string, Match[]>();
    for (const m of stageMatches) {
      const key = m.groupId ?? "_ungrouped";
      const arr = byGroup.get(key) ?? [];
      arr.push(m);
      byGroup.set(key, arr);
    }
    const sections: Section[] = [];
    for (const [gid, ms] of byGroup) {
      ms.sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0));
      const g = groupsById.get(gid);
      sections.push({
        key: gid,
        label: g ? `Gruppe ${g.label}` : null,
        matches: ms,
      });
    }
    sections.sort((a, b) => {
      const ga = groupsById.get(a.key);
      const gb = groupsById.get(b.key);
      return (ga?.position ?? 0) - (gb?.position ?? 0);
    });
    return sections;
  }

  if (stage === "ko" || stage === "ko_losers") {
    const byRound = new Map<number, Match[]>();
    for (const m of stageMatches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m);
      byRound.set(m.round, arr);
    }
    const sections: Section[] = [];
    for (const [round, ms] of byRound) {
      ms.sort((a, b) => a.matchIndex - b.matchIndex);
      sections.push({
        key: `${stage}-${round}`,
        label: ms[0]?.koLabel ?? `Runde ${round + 1}`,
        matches: ms,
      });
    }
    sections.sort((a, b) => {
      const ra = Number(a.key.split("-").at(-1));
      const rb = Number(b.key.split("-").at(-1));
      return ra - rb;
    });
    return sections;
  }

  // swiss
  const byRound = new Map<number, Match[]>();
  for (const m of stageMatches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const sections: Section[] = [];
  for (const [round, ms] of byRound) {
    ms.sort((a, b) => a.matchIndex - b.matchIndex);
    sections.push({
      key: `swiss-${round}`,
      label: `Runde ${round + 1}`,
      matches: ms,
    });
  }
  sections.sort((a, b) => {
    const ra = Number(a.key.split("-")[1]);
    const rb = Number(b.key.split("-")[1]);
    return ra - rb;
  });
  return sections;
}
