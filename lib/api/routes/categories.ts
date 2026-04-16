import { Hono } from "hono";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  categories,
  groupMembers,
  groups,
  matches,
  matchSets,
  participants,
  tournaments,
} from "@/lib/db/schema";
import {
  addParticipantsSchema,
  drawSchema,
  parseBulkNames,
  singleParticipantSchema,
  updateCategorySchema,
} from "@/lib/validators";
import {
  buildBracket,
  computeStandings,
  drawGroups,
  generateRoundRobin,
  scheduleMatches,
  type EngineGroup,
  type Player,
} from "@/lib/engine";
import { conflict, notFound, parseJson } from "../helpers";

export const categoryRoutes = new Hono()
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");

    const parts = await db
      .select()
      .from(participants)
      .where(eq(participants.categoryId, id))
      .orderBy(asc(participants.createdAt));

    const catGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.categoryId, id))
      .orderBy(asc(groups.position));

    const members = catGroups.length
      ? await db
          .select()
          .from(groupMembers)
          .where(
            inArray(
              groupMembers.groupId,
              catGroups.map((g) => g.id),
            ),
          )
      : [];

    const matchRows = await db
      .select()
      .from(matches)
      .where(eq(matches.categoryId, id))
      .orderBy(asc(matches.playOrder));

    const setRows = matchRows.length
      ? await db
          .select()
          .from(matchSets)
          .where(
            inArray(
              matchSets.matchId,
              matchRows.map((m) => m.id),
            ),
          )
          .orderBy(asc(matchSets.setNumber))
      : [];

    return c.json({
      category: cat,
      participants: parts,
      groups: catGroups,
      members,
      matches: matchRows,
      sets: setRows,
    });
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    const parsed = await parseJson(c, updateCategorySchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db
      .update(categories)
      .set(parsed.data)
      .where(eq(categories.id, id))
      .returning();
    if (!row) return notFound(c, "Spielklasse");
    return c.json({ category: row });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();
    if (!row) return notFound(c, "Spielklasse");
    return c.json({ ok: true });
  })
  // Participants
  .get("/:id/participants", async (c) => {
    const id = c.req.param("id");
    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.categoryId, id))
      .orderBy(asc(participants.createdAt));
    return c.json({ participants: rows });
  })
  .post("/:id/participants", async (c) => {
    const id = c.req.param("id");
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (cat.drawDone) return conflict(c, "Auslosung bereits abgeschlossen.");

    const body = await c.req.json().catch(() => ({}));
    if ("names" in body) {
      const parsed = addParticipantsSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Ungültige Eingabe." }, 400);
      }
      const names = parseBulkNames(parsed.data.names);
      if (names.length === 0)
        return c.json({ error: "Keine gültigen Namen gefunden." }, 400);
      const club = parsed.data.club?.trim() || null;
      const rows = await db
        .insert(participants)
        .values(names.map((name) => ({ categoryId: id, name, club })))
        .returning();
      return c.json({ participants: rows }, 201);
    }

    const parsed = singleParticipantSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Ungültige Eingabe." }, 400);
    }
    const [row] = await db
      .insert(participants)
      .values({
        categoryId: id,
        name: parsed.data.name,
        club: parsed.data.club ?? null,
        seed: parsed.data.seed ?? null,
      })
      .returning();
    return c.json({ participant: row }, 201);
  })
  .delete("/:id/participants/:participantId", async (c) => {
    const id = c.req.param("id");
    const pid = c.req.param("participantId");
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (cat.drawDone) return conflict(c, "Auslosung bereits abgeschlossen.");
    const [row] = await db
      .delete(participants)
      .where(and(eq(participants.id, pid), eq(participants.categoryId, id)))
      .returning();
    if (!row) return notFound(c, "Teilnehmer");
    return c.json({ ok: true });
  })
  // Draw groups + generate round-robin + compute schedule
  .post("/:id/draw", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const parsed = drawSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Ungültige Eingabe." }, 400);

    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (cat.drawDone) return conflict(c, "Auslosung wurde bereits ausgeführt.");

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, cat.tournamentId))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const parts = await db
      .select()
      .from(participants)
      .where(eq(participants.categoryId, id))
      .orderBy(asc(participants.createdAt));

    if (parts.length < 4) {
      return c.json({ error: "Mindestens 4 Teilnehmer nötig." }, 400);
    }

    const players: Player[] = parts.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club ?? undefined,
    }));

    const drawn = drawGroups(players, {
      groupSize: cat.groupSize,
      seed: parsed.data.seed,
    });

    // Persist groups + members + round-robin matches + schedule.
    await db.transaction(async (tx) => {
      // Clear any previous state (safety, though drawDone guards).
      await tx.delete(groups).where(eq(groups.categoryId, id));
      await tx.delete(matches).where(eq(matches.categoryId, id));

      const groupRows = await tx
        .insert(groups)
        .values(
          drawn.map((g) => ({
            categoryId: id,
            label: g.label,
            position: g.position,
          })),
        )
        .returning();

      const groupByLabel = new Map(groupRows.map((g) => [g.label, g]));
      const memberInserts = drawn.flatMap((g) =>
        g.players.map((p, idx) => ({
          groupId: groupByLabel.get(g.label)!.id,
          participantId: p.id,
          position: idx + 1,
        })),
      );
      if (memberInserts.length > 0) {
        await tx.insert(groupMembers).values(memberInserts);
      }

      // Round-robin per group → collect all matches, schedule globally.
      const allMatchInserts: (typeof matches.$inferInsert)[] = [];
      for (const dg of drawn) {
        const group = groupByLabel.get(dg.label)!;
        const plan = generateRoundRobin(dg.players);
        for (const m of plan) {
          allMatchInserts.push({
            categoryId: id,
            stage: "group",
            groupId: group.id,
            round: m.round,
            matchIndex: m.matchIndex,
            participantAId: m.a.id,
            participantBId: m.b.id,
          });
        }
      }

      // Order: interleave by round so parallel tables see different groups.
      allMatchInserts.sort(
        (x, y) =>
          (x.round ?? 0) - (y.round ?? 0) ||
          (x.matchIndex ?? 0) - (y.matchIndex ?? 0),
      );

      // Schedule using tournament config.
      const scheduled = scheduleMatches(
        allMatchInserts.map((_m, i) => `tmp-${i}`),
        {
          startTime: tournament.startTime,
          parallelTables: tournament.parallelTables,
          matchDurationMinutes: tournament.matchDurationMinutes,
        },
      );
      const baseDate = tournament.startDate ?? startOfToday();

      allMatchInserts.forEach((m, i) => {
        const s = scheduled[i]!;
        m.playOrder = s.playOrder;
        m.tableNumber = s.tableNumber;
        m.scheduledAt = applyWallClock(baseDate, s.wallClock);
      });

      if (allMatchInserts.length > 0) {
        await tx.insert(matches).values(allMatchInserts);
      }

      await tx
        .update(categories)
        .set({ drawDone: true })
        .where(eq(categories.id, id));

      await tx
        .update(tournaments)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(tournaments.id, cat.tournamentId));
    });

    return c.json({ ok: true });
  })
  // Rebuild the KO bracket from current standings
  .post("/:id/bracket", async (c) => {
    const id = c.req.param("id");
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (!cat.drawDone)
      return conflict(c, "Auslosung muss erst abgeschlossen sein.");

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, cat.tournamentId))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const { engineGroups } = await loadEngineGroups(id);

    const bracket = buildBracket({ groups: engineGroups });

    await db.transaction(async (tx) => {
      // Wipe existing KO matches (and reset cache).
      await tx
        .delete(matches)
        .where(and(eq(matches.categoryId, id), eq(matches.stage, "ko")));

      // Insert new KO matches, preserving "bracket id" ordering.
      const orderOffset = await tx
        .select({ n: matches.playOrder })
        .from(matches)
        .where(eq(matches.categoryId, id))
        .orderBy(desc(matches.playOrder))
        .limit(1);
      const startOrder = (orderOffset[0]?.n ?? -1) + 1;

      const inserts: (typeof matches.$inferInsert & { _bid: string })[] = [];
      const bidToMatch = new Map<string, { bid: string; data: typeof matches.$inferInsert & { _bid: string } }>();

      bracket.matches.forEach((bm, idx) => {
        const data = {
          _bid: bm.id,
          categoryId: id,
          stage: "ko" as const,
          round: bm.round,
          matchIndex: bm.matchIndex,
          koLabel: bm.label,
          participantAId: bm.a.kind === "player" ? bm.a.playerId : null,
          participantBId: bm.b.kind === "player" ? bm.b.playerId : null,
          playOrder: startOrder + idx,
          tableNumber: ((startOrder + idx) % tournament.parallelTables) + 1,
          scheduledAt: applyWallClock(
            tournament.startDate ?? startOfToday(),
            formatFromMinutes(
              parseHHMM(tournament.startTime) +
                Math.floor((startOrder + idx) / tournament.parallelTables) *
                  tournament.matchDurationMinutes,
            ),
          ),
        };
        inserts.push(data);
        bidToMatch.set(bm.id, { bid: bm.id, data });
      });

      // First pass insert to get real DB ids, then update sourceMatch refs.
      const insertedRows = inserts.length
        ? await tx
            .insert(matches)
            .values(inserts.map(({ _bid: _b, ...rest }) => rest))
            .returning()
        : [];

      // Map bracket id -> db id
      const bidToDbId = new Map<string, string>();
      insertedRows.forEach((row, i) => {
        const bid = inserts[i]!._bid;
        bidToDbId.set(bid, row.id);
      });

      // Second pass: for pending slots, fill sourceMatch*Id.
      for (const bm of bracket.matches) {
        const dbId = bidToDbId.get(bm.id);
        if (!dbId) continue;
        const update: { sourceMatchAId?: string; sourceMatchBId?: string } = {};
        if (bm.a.kind === "pending") {
          const srcDb = bidToDbId.get(bm.a.fromMatchId);
          if (srcDb) update.sourceMatchAId = srcDb;
        }
        if (bm.b.kind === "pending") {
          const srcDb = bidToDbId.get(bm.b.fromMatchId);
          if (srcDb) update.sourceMatchBId = srcDb;
        }
        if (Object.keys(update).length > 0) {
          await tx.update(matches).set(update).where(eq(matches.id, dbId));
        }
      }

      await tx
        .update(categories)
        .set({ bracketDone: true })
        .where(eq(categories.id, id));
    });

    return c.json({ ok: true, size: bracket.size, luckyLosers: bracket.luckyLosers });
  });

// ---------- helpers ----------

async function loadEngineGroups(
  categoryId: string,
): Promise<{ engineGroups: EngineGroup[] }> {
  const catGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.categoryId, categoryId))
    .orderBy(asc(groups.position));

  if (catGroups.length === 0) return { engineGroups: [] };

  const groupIds = catGroups.map((g) => g.id);
  const allMembers = await db
    .select({
      groupId: groupMembers.groupId,
      participantId: groupMembers.participantId,
      position: groupMembers.position,
      name: participants.name,
      club: participants.club,
    })
    .from(groupMembers)
    .innerJoin(participants, eq(groupMembers.participantId, participants.id))
    .where(inArray(groupMembers.groupId, groupIds));

  const groupMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.categoryId, categoryId), eq(matches.stage, "group")));

  const setRows = groupMatches.length
    ? await db
        .select()
        .from(matchSets)
        .where(
          inArray(
            matchSets.matchId,
            groupMatches.map((m) => m.id),
          ),
        )
        .orderBy(asc(matchSets.setNumber))
    : [];

  const setsByMatch = new Map<string, { a: number; b: number }[]>();
  for (const s of setRows) {
    const arr = setsByMatch.get(s.matchId) ?? [];
    arr.push({ a: s.pointsA, b: s.pointsB });
    setsByMatch.set(s.matchId, arr);
  }

  const engineGroups: EngineGroup[] = catGroups.map((g) => {
    const members = allMembers
      .filter((m) => m.groupId === g.id)
      .sort((a, b) => a.position - b.position);
    const groupMatchRows = groupMatches.filter((m) => m.groupId === g.id);
    return {
      id: g.id,
      label: g.label,
      players: members.map<Player>((m) => ({
        id: m.participantId,
        name: m.name,
        club: m.club ?? undefined,
      })),
      matches: groupMatchRows.map((m) => ({
        id: m.id,
        a: m.participantAId,
        b: m.participantBId,
        sets: setsByMatch.get(m.id) ?? [],
      })),
    };
  });

  return { engineGroups };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatFromMinutes(total: number): string {
  const day = 24 * 60;
  const norm = ((total % day) + day) % day;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function applyWallClock(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date(base);
  d.setHours(h ?? 10, m ?? 0, 0, 0);
  return d;
}

export { loadEngineGroups };
