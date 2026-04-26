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
  updateParticipantSchema,
} from "@/lib/validators";
import {
  buildBracket,
  computeMatchOutcome,
  computeStandings,
  drawGroups,
  generateRandomMatchSets,
  generateRoundRobin,
  scheduleMatches,
  scheduleMatchesWithRest,
  isTournamentStructure,
  type EngineGroup,
  type Player,
  type TournamentStructure,
  type DrawMode,
} from "@/lib/engine";
import type { SeededPlayer } from "@/lib/engine/draw";
import { buildKoOnly } from "@/lib/engine/koOnly";
import { planRoundRobinOnly } from "@/lib/engine/roundRobinOnly";
import {
  planSwissRound,
  type SwissHistoryMatch,
} from "@/lib/engine/swiss";
import { publishAdminRevision, publishCategoryRevision } from "@/lib/live";
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
    publishCategoryRevision(id);
    return c.json({ category: row });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [row] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();
    if (!row) return notFound(c, "Spielklasse");
    publishAdminRevision();
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
      // Assign monotonically increasing timestamps so the paste order is
      // preserved when reading rows back ordered by createdAt. Without this,
      // a single batched insert lets them collapse to the same instant and
      // sorting becomes undefined - which matters for the paste_order draw
      // mode.
      const baseMs = Date.now();
      const rows = await db
        .insert(participants)
        .values(
          names.map((name, i) => ({
            categoryId: id,
            name,
            club,
            createdAt: new Date(baseMs + i),
          })),
        )
        .returning();
      publishAdminRevision();
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
    publishAdminRevision();
    return c.json({ participant: row }, 201);
  })
  // Rename a participant (or update club). Allowed at any point in the
  // tournament because changing display text doesn't affect match logic -
  // it's just a fix for typos or no-shows being relabeled.
  .patch("/:id/participants/:participantId", async (c) => {
    const id = c.req.param("id");
    const pid = c.req.param("participantId");
    const parsed = await parseJson(c, updateParticipantSchema);
    if (!parsed.ok) return parsed.response;

    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");

    const updates: Partial<typeof participants.$inferInsert> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.club !== undefined) {
      const club = parsed.data.club;
      updates.club = club === null ? null : club.trim() || null;
    }

    const [row] = await db
      .update(participants)
      .set(updates)
      .where(and(eq(participants.id, pid), eq(participants.categoryId, id)))
      .returning();
    if (!row) return notFound(c, "Teilnehmer");
    publishCategoryRevision(id);
    return c.json({ participant: row });
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

    // Pre-draw: simple delete, the participant has no group/match yet.
    if (!cat.drawDone) {
      const [row] = await db
        .delete(participants)
        .where(and(eq(participants.id, pid), eq(participants.categoryId, id)))
        .returning();
      if (!row) return notFound(c, "Teilnehmer");
      publishAdminRevision();
      return c.json({ ok: true });
    }

    // Post-draw group-phase removal: used for no-shows. Same guard rails as
    // /groups/move - we refuse once any match has been touched or the KO
    // bracket exists, because both would silently invalidate persisted
    // results. Only group-stage structures have a regenerable schedule.
    if (
      cat.structure !== "groups_ko" &&
      cat.structure !== "round_robin" &&
      cat.structure !== "round_robin_finals"
    ) {
      return conflict(
        c,
        "Entfernen nach Auslosung nur in Gruppen-/Liga-Strukturen möglich.",
      );
    }
    if (cat.bracketDone) {
      return conflict(
        c,
        "Finalbaum steht bereits - Entfernen würde Ergebnisse verwerfen.",
      );
    }

    const catMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.categoryId, id));
    const alreadyPlayed = catMatches.some((m) => m.status !== "pending");
    if (alreadyPlayed) {
      return conflict(
        c,
        "Mindestens ein Spiel wurde bereits begonnen - Entfernen nicht mehr möglich.",
      );
    }

    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.participantId, pid))
      .limit(1);
    // No group membership means the player wasn't placed (shouldn't happen
    // post-draw, but treat as a plain delete).
    if (!membership) {
      const [row] = await db
        .delete(participants)
        .where(and(eq(participants.id, pid), eq(participants.categoryId, id)))
        .returning();
      if (!row) return notFound(c, "Teilnehmer");
      publishCategoryRevision(id);
      return c.json({ ok: true });
    }

    const sourceMembers = await db
      .select({ participantId: groupMembers.participantId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, membership.groupId));
    if (sourceMembers.length <= 2) {
      return conflict(
        c,
        "Gruppe hätte nach dem Entfernen weniger als 2 Spieler.",
      );
    }

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, cat.tournamentId))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const remainingMembers = await db
      .select({
        participantId: groupMembers.participantId,
        position: groupMembers.position,
        name: participants.name,
        club: participants.club,
      })
      .from(groupMembers)
      .innerJoin(participants, eq(groupMembers.participantId, participants.id))
      .where(eq(groupMembers.groupId, membership.groupId))
      .orderBy(asc(groupMembers.position));
    const survivors = remainingMembers.filter((m) => m.participantId !== pid);

    const [deleted] = await db.transaction(async (tx) => {
      // Drop the participant - cascades remove the groupMembers row and
      // also any group matches involving them (matches.participantA/BId
      // are ON DELETE SET NULL, so we wipe + regenerate the group's
      // schedule below to keep the round-robin clean).
      const [row] = await tx
        .delete(participants)
        .where(
          and(eq(participants.id, pid), eq(participants.categoryId, id)),
        )
        .returning();

      // Re-number positions so they stay 1..n contiguous in the source group.
      for (let i = 0; i < survivors.length; i++) {
        await tx
          .update(groupMembers)
          .set({ position: i + 1 })
          .where(
            and(
              eq(groupMembers.groupId, membership.groupId),
              eq(groupMembers.participantId, survivors[i]!.participantId),
            ),
          );
      }

      // Wipe + regenerate group matches just for the affected group. The
      // rest of the category keeps its existing playOrder untouched.
      await tx
        .delete(matches)
        .where(
          and(
            eq(matches.categoryId, id),
            eq(matches.stage, "group"),
            eq(matches.groupId, membership.groupId),
          ),
        );

      const orderOffset = await tx
        .select({ n: matches.playOrder })
        .from(matches)
        .where(eq(matches.categoryId, id))
        .orderBy(desc(matches.playOrder))
        .limit(1);
      let nextOrder = (orderOffset[0]?.n ?? -1) + 1;

      const groupPlayers: Player[] = survivors.map((m) => ({
        id: m.participantId,
        name: m.name,
        club: m.club ?? undefined,
      }));
      if (groupPlayers.length >= 2) {
        const plan = generateRoundRobin(groupPlayers);
        for (const m of plan) {
          await tx.insert(matches).values({
            categoryId: id,
            stage: "group",
            groupId: membership.groupId,
            round: m.round,
            matchIndex: m.matchIndex,
            participantAId: m.a.id,
            participantBId: m.b.id,
            playOrder: nextOrder,
            tableNumber: (nextOrder % tournament.parallelTables) + 1,
          });
          nextOrder++;
        }
      }

      return [row];
    });

    if (!deleted) return notFound(c, "Teilnehmer");
    publishCategoryRevision(id);
    return c.json({ ok: true });
  })
  // Draw / plan - dispatches on category.structure.
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

    const structure: TournamentStructure = isTournamentStructure(cat.structure)
      ? cat.structure
      : "groups_ko";
    const drawMode = (cat.drawMode as DrawMode) ?? "random";

    const minCount =
      structure === "groups_ko" || structure === "round_robin_finals"
        ? 4
        : 2;
    if (parts.length < minCount) {
      return c.json(
        { error: `Mindestens ${minCount} Teilnehmer nötig.` },
        400,
      );
    }

    const players: SeededPlayer[] = parts.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club ?? undefined,
      seed: p.seed ?? null,
    }));

    const scheduleCfg = {
      parallelTables: tournament.parallelTables,
      matchDurationMinutes: tournament.matchDurationMinutes,
    };

    if (
      structure === "groups_ko" ||
      structure === "round_robin" ||
      structure === "round_robin_finals"
    ) {
      const drawn =
        structure === "groups_ko"
          ? drawGroups(players, {
              groupSize: cat.groupSize,
              seed: parsed.data.seed,
              drawMode,
            })
          : [
              {
                label: planRoundRobinOnly({ players, drawMode }).group.label,
                position: 0,
                players: planRoundRobinOnly({ players, drawMode }).group
                  .players,
              },
            ];

      await db.transaction(async (tx) => {
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

        allMatchInserts.sort(
          (x, y) =>
            (x.round ?? 0) - (y.round ?? 0) ||
            (x.matchIndex ?? 0) - (y.matchIndex ?? 0),
        );

        // Smart scheduler: keeps the same player off two consecutive time
        // slots when a different match is available. The order coming in
        // (round, matchIndex) acts as a tiebreaker, so the round-robin's
        // natural round progression survives where it can.
        const scheduled = scheduleMatchesWithRest(
          allMatchInserts.map((m, i) => ({
            id: `tmp-${i}`,
            a: m.participantAId ?? null,
            b: m.participantBId ?? null,
          })),
          scheduleCfg,
        );
        const orderedInserts = scheduled.map((s) => {
          const tmpIdx = Number(s.matchId.slice(4));
          const base = allMatchInserts[tmpIdx]!;
          return {
            ...base,
            playOrder: s.playOrder,
            tableNumber: s.tableNumber,
          };
        });

        if (orderedInserts.length > 0) {
          await tx.insert(matches).values(orderedInserts);
        }

        await tx
          .update(categories)
          .set({
            drawDone: true,
            // Round-robin has no separate bracket stage.
            ...(structure === "round_robin" ? { bracketDone: true } : {}),
          })
          .where(eq(categories.id, id));

        await tx
          .update(tournaments)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(tournaments.id, cat.tournamentId));
      });

      publishCategoryRevision(id);
      return c.json({ ok: true });
    }

    if (structure === "ko_only") {
      const bracket = buildKoOnly({ players, seed: parsed.data.seed });

      await db.transaction(async (tx) => {
        await tx.delete(groups).where(eq(groups.categoryId, id));
        await tx.delete(matches).where(eq(matches.categoryId, id));

        await insertBracketMatches(tx, id, bracket.matches, {
          stage: "ko",
          parallelTables: tournament.parallelTables,
          startOrder: 0,
        });

        await tx
          .update(categories)
          .set({ drawDone: true, bracketDone: true })
          .where(eq(categories.id, id));

        await tx
          .update(tournaments)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(tournaments.id, cat.tournamentId));
      });

      publishCategoryRevision(id);
      return c.json({ ok: true });
    }

    if (structure === "swiss") {
      const plan = planSwissRound({ players });

      await db.transaction(async (tx) => {
        await tx.delete(groups).where(eq(groups.categoryId, id));
        await tx.delete(matches).where(eq(matches.categoryId, id));

        const scheduled = scheduleMatches(
          plan.matches.map((_m, i) => `tmp-${i}`),
          scheduleCfg,
        );
        const inserts: (typeof matches.$inferInsert)[] = plan.matches.map(
          (m, i) => ({
            categoryId: id,
            stage: "swiss" as const,
            round: m.round,
            matchIndex: m.matchIndex,
            participantAId: m.a,
            participantBId: m.b,
            playOrder: scheduled[i]!.playOrder,
            tableNumber: scheduled[i]!.tableNumber,
          }),
        );
        if (inserts.length > 0) await tx.insert(matches).values(inserts);

        await tx
          .update(categories)
          .set({ drawDone: true })
          .where(eq(categories.id, id));

        await tx
          .update(tournaments)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(tournaments.id, cat.tournamentId));
      });

      publishCategoryRevision(id);
      return c.json({ ok: true, byePlayerId: plan.byePlayerId });
    }

    return c.json({ error: "Unbekannte Turnierstruktur." }, 400);
  })
  // Plan the next Swiss round from previous results. Only valid when
  // structure === "swiss" and the previous round is fully finished.
  .post("/:id/swiss/round", async (c) => {
    const id = c.req.param("id");
    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (cat.structure !== "swiss") {
      return conflict(c, "Diese Spielklasse ist kein Schweizer System.");
    }
    if (!cat.drawDone) {
      return conflict(c, "Die erste Runde muss zuerst gelost sein.");
    }
    if (cat.bracketDone) {
      return conflict(c, "Das Turnier ist bereits abgeschlossen.");
    }

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

    const swissMatches = await db
      .select()
      .from(matches)
      .where(and(eq(matches.categoryId, id), eq(matches.stage, "swiss")))
      .orderBy(asc(matches.round), asc(matches.matchIndex));
    const setRows = swissMatches.length
      ? await db
          .select()
          .from(matchSets)
          .where(
            inArray(
              matchSets.matchId,
              swissMatches.map((m) => m.id),
            ),
          )
          .orderBy(asc(matchSets.setNumber))
      : [];

    // Require latest round fully finished before pairing the next one.
    const maxRound = swissMatches.reduce((m, r) => Math.max(m, r.round), -1);
    const lastRoundMatches = swissMatches.filter((m) => m.round === maxRound);
    const unfinished = lastRoundMatches.filter(
      (m) => m.status !== "finished" && m.participantBId !== null,
    );
    if (unfinished.length > 0) {
      return c.json(
        { error: "Erst alle Spiele der letzten Runde abschließen." },
        400,
      );
    }

    if (maxRound + 1 >= cat.swissRounds) {
      return conflict(c, "Alle Schweizer Runden sind bereits gespielt.");
    }

    const setsByMatch = new Map<string, { a: number; b: number }[]>();
    for (const s of setRows) {
      const arr = setsByMatch.get(s.matchId) ?? [];
      arr.push({ a: s.pointsA, b: s.pointsB });
      setsByMatch.set(s.matchId, arr);
    }
    const history: SwissHistoryMatch[] = swissMatches.map((m) => ({
      round: m.round,
      a: m.participantAId!,
      b: m.participantBId,
      sets: setsByMatch.get(m.id) ?? [],
    }));

    const players: SeededPlayer[] = parts.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club ?? undefined,
      seed: p.seed ?? null,
    }));

    const plan = planSwissRound({ players, history });

    const scheduleCfg = {
      parallelTables: tournament.parallelTables,
      matchDurationMinutes: tournament.matchDurationMinutes,
    };

    await db.transaction(async (tx) => {
      const orderOffset = await tx
        .select({ n: matches.playOrder })
        .from(matches)
        .where(eq(matches.categoryId, id))
        .orderBy(desc(matches.playOrder))
        .limit(1);
      const startOrder = (orderOffset[0]?.n ?? -1) + 1;

      const scheduled = scheduleMatches(
        plan.matches.map((_m, i) => `tmp-${i}`),
        scheduleCfg,
      );
      const inserts: (typeof matches.$inferInsert)[] = plan.matches.map(
        (m, i) => ({
          categoryId: id,
          stage: "swiss" as const,
          round: m.round,
          matchIndex: m.matchIndex,
          participantAId: m.a,
          participantBId: m.b,
          playOrder: startOrder + scheduled[i]!.playOrder,
          tableNumber: scheduled[i]!.tableNumber,
        }),
      );
      if (inserts.length > 0) await tx.insert(matches).values(inserts);

      if (plan.round + 1 >= cat.swissRounds) {
        await tx
          .update(categories)
          .set({ bracketDone: true })
          .where(eq(categories.id, id));
      }
    });

    publishCategoryRevision(id);
    return c.json({
      ok: true,
      round: plan.round,
      byePlayerId: plan.byePlayerId,
    });
  })
  // Move a participant from one group to another, for last-minute group
  // rearrangements before any match has started. Refuses once the first
  // match has been played or the KO bracket has been built; in both cases
  // redrawing would silently invalidate results the admin probably cares
  // about. Group matches for both source and target groups are re-generated
  // in-place, preserving the categoryʼs overall play order.
  .post("/:id/groups/move", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const participantId =
      typeof body?.participantId === "string" ? body.participantId : null;
    const targetGroupId =
      typeof body?.targetGroupId === "string" ? body.targetGroupId : null;
    if (!participantId || !targetGroupId) {
      return c.json(
        { error: "participantId und targetGroupId sind erforderlich." },
        400,
      );
    }

    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (cat.structure !== "groups_ko") {
      return conflict(
        c,
        "Spieler können nur in Gruppen→KO-Turnieren verschoben werden.",
      );
    }
    if (!cat.drawDone) {
      return conflict(c, "Auslosung muss erst abgeschlossen sein.");
    }
    if (cat.bracketDone) {
      return conflict(
        c,
        "Finalbaum steht bereits - Gruppenwechsel würde Ergebnisse verwerfen.",
      );
    }

    const catMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.categoryId, id));
    const alreadyPlayed = catMatches.some((m) => m.status !== "pending");
    if (alreadyPlayed) {
      return conflict(
        c,
        "Mindestens ein Spiel wurde bereits begonnen - Verschieben nicht mehr möglich.",
      );
    }

    const catGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.categoryId, id))
      .orderBy(asc(groups.position));
    const targetGroup = catGroups.find((g) => g.id === targetGroupId);
    if (!targetGroup) return notFound(c, "Zielgruppe");

    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.participantId, participantId))
      .limit(1);
    if (!membership) return notFound(c, "Gruppenzuordnung");
    const sourceGroup = catGroups.find((g) => g.id === membership.groupId);
    if (!sourceGroup) return notFound(c, "Ausgangsgruppe");
    if (sourceGroup.id === targetGroup.id) {
      return c.json({ ok: true, unchanged: true });
    }

    // A group with fewer than 2 members has no round-robin schedule; the
    // move would silently drop the source group from the tournament.
    const sourceMemberCount = await db
      .select({ participantId: groupMembers.participantId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, sourceGroup.id));
    if (sourceMemberCount.length <= 2) {
      return conflict(
        c,
        "Ausgangsgruppe hätte nach dem Verschieben weniger als 2 Spieler.",
      );
    }

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, cat.tournamentId))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

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
      .where(
        inArray(
          groupMembers.groupId,
          catGroups.map((g) => g.id),
        ),
      )
      .orderBy(asc(groupMembers.position));

    await db.transaction(async (tx) => {
      // Flip the membership.
      await tx
        .update(groupMembers)
        .set({ groupId: targetGroup.id })
        .where(eq(groupMembers.participantId, participantId));

      // Re-number positions in both affected groups (keep original order,
      // append moved player at the end of the target).
      const affected = [sourceGroup.id, targetGroup.id];
      for (const gid of affected) {
        const updatedMembers =
          gid === sourceGroup.id
            ? allMembers.filter(
                (m) =>
                  m.groupId === gid && m.participantId !== participantId,
              )
            : [
                ...allMembers.filter((m) => m.groupId === gid),
                allMembers.find((m) => m.participantId === participantId)!,
              ];
        for (let i = 0; i < updatedMembers.length; i++) {
          await tx
            .update(groupMembers)
            .set({ position: i + 1 })
            .where(
              and(
                eq(groupMembers.groupId, gid),
                eq(
                  groupMembers.participantId,
                  updatedMembers[i]!.participantId,
                ),
              ),
            );
        }
      }

      // Wipe + regenerate group matches for the two affected groups. The
      // rest of the category keeps its existing schedule untouched.
      await tx
        .delete(matches)
        .where(
          and(
            eq(matches.categoryId, id),
            eq(matches.stage, "group"),
            inArray(matches.groupId, affected),
          ),
        );

      const orderOffset = await tx
        .select({ n: matches.playOrder })
        .from(matches)
        .where(eq(matches.categoryId, id))
        .orderBy(desc(matches.playOrder))
        .limit(1);
      let nextOrder = (orderOffset[0]?.n ?? -1) + 1;

      for (const gid of affected) {
        const group = catGroups.find((g) => g.id === gid)!;
        const membersForGroup =
          gid === sourceGroup.id
            ? allMembers.filter(
                (m) =>
                  m.groupId === gid && m.participantId !== participantId,
              )
            : [
                ...allMembers.filter((m) => m.groupId === gid),
                allMembers.find((m) => m.participantId === participantId)!,
              ];
        const groupPlayers: Player[] = membersForGroup.map((m) => ({
          id: m.participantId,
          name: m.name,
          club: m.club ?? undefined,
        }));
        if (groupPlayers.length < 2) continue;
        const plan = generateRoundRobin(groupPlayers);
        for (const m of plan) {
          await tx.insert(matches).values({
            categoryId: id,
            stage: "group",
            groupId: group.id,
            round: m.round,
            matchIndex: m.matchIndex,
            participantAId: m.a.id,
            participantBId: m.b.id,
            playOrder: nextOrder,
            tableNumber: (nextOrder % tournament.parallelTables) + 1,
          });
          nextOrder++;
        }
      }
    });

    publishCategoryRevision(id);
    return c.json({
      ok: true,
      from: sourceGroup.label,
      to: targetGroup.label,
    });
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

    if (
      cat.structure !== "groups_ko" &&
      cat.structure !== "round_robin_finals"
    ) {
      return conflict(
        c,
        "Finalbaum gibt es nur bei Gruppen → KO oder Jeder gegen jeden + Finale. Andere Strukturen erzeugen ihren Spielplan beim Auslosen.",
      );
    }

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, cat.tournamentId))
      .limit(1);
    if (!tournament) return notFound(c, "Turnier");

    const existingKo = await db
      .select({
        status: matches.status,
        participantAId: matches.participantAId,
        participantBId: matches.participantBId,
      })
      .from(matches)
      .where(
        and(
          eq(matches.categoryId, id),
          inArray(matches.stage, ["ko", "ko_losers"] as const),
        ),
      );
    // A bye/freilos match is auto-finished at insert time with one side null.
    // Treat only matches with both participants set as "really played" so a
    // bracket consisting only of byes can still be rebuilt.
    const hasPlayedKo = existingKo.some(
      (m) =>
        m.status !== "pending" &&
        m.participantAId !== null &&
        m.participantBId !== null,
    );
    if (hasPlayedKo) {
      return conflict(
        c,
        "Finalbaum enthält bereits gespielte Partien - Neubau würde Ergebnisse verwerfen.",
      );
    }

    const { engineGroups } = await loadEngineGroups(id);

    // round_robin_finals: build just two matches - 1 vs 2 (Finale) and
    // 3 vs 4 (Spiel um Platz 3) - from the single round-robin group's
    // standings. All league matches must already be finished so the
    // top-4 ranking is final; otherwise mid-tournament rebuilds could
    // seat the wrong pairs.
    if (cat.structure === "round_robin_finals") {
      const group = engineGroups[0];
      if (!group) return conflict(c, "Keine Gruppe vorhanden.");
      const groupMatchRows = await db
        .select({ status: matches.status })
        .from(matches)
        .where(
          and(eq(matches.categoryId, id), eq(matches.stage, "group")),
        );
      if (groupMatchRows.some((m) => m.status !== "finished")) {
        return conflict(
          c,
          "Alle Ligaspiele müssen abgeschlossen sein, bevor die Finalspiele erstellt werden.",
        );
      }

      const standing = computeStandings(group);
      if (standing.rows.length < 4) {
        return conflict(
          c,
          "Für Finalspiele werden mindestens 4 Spieler in der Rangliste benötigt.",
        );
      }
      const [first, second, third, fourth] = standing.rows;

      await db.transaction(async (tx) => {
        await tx
          .delete(matches)
          .where(
            and(
              eq(matches.categoryId, id),
              inArray(matches.stage, ["ko", "ko_losers"] as const),
            ),
          );

        const orderOffset = await tx
          .select({ n: matches.playOrder })
          .from(matches)
          .where(eq(matches.categoryId, id))
          .orderBy(desc(matches.playOrder))
          .limit(1);
        const startOrder = (orderOffset[0]?.n ?? -1) + 1;

        // Bronze is listed first so it plays before the Finale on the
        // same table rotation. They're placed in separate round slots
        // (0 and 1) so the TreeBracket renders them in two labeled
        // columns; there is no source-match link between them, so no
        // connector line is drawn and the displayed label of each
        // column comes straight from `koLabel`.
        await tx.insert(matches).values([
          {
            categoryId: id,
            stage: "ko" as const,
            round: 0,
            matchIndex: 0,
            koLabel: "Spiel um Platz 3",
            participantAId: third!.playerId,
            participantBId: fourth!.playerId,
            playOrder: startOrder,
            tableNumber: (startOrder % tournament.parallelTables) + 1,
          },
          {
            categoryId: id,
            stage: "ko" as const,
            round: 1,
            matchIndex: 0,
            koLabel: "Finale",
            participantAId: first!.playerId,
            participantBId: second!.playerId,
            playOrder: startOrder + 1,
            tableNumber: ((startOrder + 1) % tournament.parallelTables) + 1,
          },
        ]);

        await tx
          .update(categories)
          .set({ bracketDone: true })
          .where(eq(categories.id, id));
      });

      publishCategoryRevision(id);
      return c.json({ ok: true, size: 2, losersSize: 0, losersEntries: [] });
    }

    const bracket = buildBracket({
      groups: engineGroups,
      advancementCount: cat.groupAdvancementCount,
      luckyLoserEnabled: cat.luckyLoserEnabled,
    });

    await db.transaction(async (tx) => {
      // Wipe existing KO matches (main + losers).
      await tx
        .delete(matches)
        .where(
          and(
            eq(matches.categoryId, id),
            inArray(matches.stage, ["ko", "ko_losers"] as const),
          ),
        );

      const orderOffset = await tx
        .select({ n: matches.playOrder })
        .from(matches)
        .where(eq(matches.categoryId, id))
        .orderBy(desc(matches.playOrder))
        .limit(1);
      let startOrder = (orderOffset[0]?.n ?? -1) + 1;

      await insertBracketMatches(tx, id, bracket.matches, {
        stage: "ko",
        parallelTables: tournament.parallelTables,
        startOrder,
      });
      startOrder += bracket.matches.length;

      if (bracket.losers && bracket.losers.matches.length > 0) {
        await insertBracketMatches(tx, id, bracket.losers.matches, {
          stage: "ko_losers",
          parallelTables: tournament.parallelTables,
          startOrder,
        });
      }

      await tx
        .update(categories)
        .set({ bracketDone: true })
        .where(eq(categories.id, id));
    });

    publishCategoryRevision(id);
    return c.json({
      ok: true,
      size: bracket.size,
      losersSize: bracket.losers?.size ?? 0,
      losersEntries: bracket.losersEntries,
    });
  })
  // Populate random results for all pending matches of a category. Admins
  // can use this to quickly play through a tournament without entering every
  // score by hand (trainings, demos, dry-runs). Only pending matches are
  // touched; finished results are never overwritten.
  .post("/:id/populate-test-results", async (c) => {
    const id = c.req.param("id");
    const stageParam = c.req.query("stage");
    const stageFilter =
      stageParam === "group" ||
      stageParam === "ko" ||
      stageParam === "ko_losers" ||
      stageParam === "swiss"
        ? stageParam
        : null;
    if (stageParam && stageFilter === null) {
      return c.json(
        { error: "Ungültiger Stage-Filter (group, ko, ko_losers, swiss)." },
        400,
      );
    }

    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) return notFound(c, "Spielklasse");
    if (!cat.drawDone) {
      return conflict(c, "Auslosung muss erst abgeschlossen sein.");
    }

    const winSets = cat.winSets;
    const setPoints = cat.setPoints;
    const minLead = cat.setMinLead;

    let filled = 0;

    // Loop because finishing a KO match unblocks the next round (the
    // downstream match inherits the winner, so it becomes fillable). When a
    // stage filter is set, a single pass suffices (no downstream propagation
    // inside the same stage for groups/swiss).
    const maxPasses = stageFilter === "group" || stageFilter === "swiss" ? 1 : 20;
    for (let pass = 0; pass < maxPasses; pass++) {
      const all = await db
        .select()
        .from(matches)
        .where(eq(matches.categoryId, id))
        .orderBy(asc(matches.playOrder));
      const fillable = all.filter(
        (m) =>
          m.status !== "finished" &&
          m.participantAId !== null &&
          m.participantBId !== null &&
          (stageFilter === null || m.stage === stageFilter),
      );
      if (fillable.length === 0) break;

      for (const m of fillable) {
        const sets = generateRandomMatchSets({ winSets, setPoints, minLead });
        const outcome = computeMatchOutcome(sets, winSets, {
          setPoints,
          minLead,
        });
        if (!outcome.winner) continue;
        const winnerId =
          outcome.winner === "A" ? m.participantAId! : m.participantBId!;

        await db.transaction(async (tx) => {
          await tx.delete(matchSets).where(eq(matchSets.matchId, m.id));
          await tx.insert(matchSets).values(
            sets.map((s, i) => ({
              matchId: m.id,
              setNumber: i + 1,
              pointsA: s.a,
              pointsB: s.b,
            })),
          );
          await tx
            .update(matches)
            .set({
              status: "finished",
              setsA: outcome.setsA,
              setsB: outcome.setsB,
              winnerParticipantId: winnerId,
              updatedAt: new Date(),
            })
            .where(eq(matches.id, m.id));

          const downstream = await tx
            .select()
            .from(matches)
            .where(
              and(
                inArray(matches.stage, ["ko", "ko_losers"] as const),
                eq(matches.categoryId, id),
              ),
            );
          for (const d of downstream) {
            const updates: {
              participantAId?: string;
              participantBId?: string;
            } = {};
            if (d.sourceMatchAId === m.id) updates.participantAId = winnerId;
            if (d.sourceMatchBId === m.id) updates.participantBId = winnerId;
            if (Object.keys(updates).length > 0) {
              await tx
                .update(matches)
                .set(updates)
                .where(eq(matches.id, d.id));
            }
          }
        });
        filled++;
      }
    }

    if (filled > 0) publishCategoryRevision(id);
    return c.json({ ok: true, filled });
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

/**
 * Persist a freshly-built bracket (main or losers). Inserts every bracket
 * match, then back-fills sourceMatch*Id references from the local bracket
 * ids.
 */
async function insertBracketMatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  categoryId: string,
  bracketMatches: readonly {
    id: string;
    round: number;
    matchIndex: number;
    label: string;
    a:
      | { kind: "player"; playerId: string }
      | { kind: "pending"; fromMatchId: string }
      | { kind: "empty" };
    b:
      | { kind: "player"; playerId: string }
      | { kind: "pending"; fromMatchId: string }
      | { kind: "empty" };
  }[],
  schedule: {
    stage: "ko" | "ko_losers";
    parallelTables: number;
    startOrder: number;
  },
) {
  const { stage, parallelTables, startOrder } = schedule;

  // Bye matches have one side filled with a player and the other empty. The
  // filled player auto-wins; we mark them finished at insert time so their
  // winner is already known downstream and no admin click is needed.
  const byeWinner = (
    bm: (typeof bracketMatches)[number],
  ): string | null => {
    if (bm.a.kind === "player" && bm.b.kind === "empty") return bm.a.playerId;
    if (bm.b.kind === "player" && bm.a.kind === "empty") return bm.b.playerId;
    return null;
  };

  const inserts: (typeof matches.$inferInsert & { _bid: string })[] =
    bracketMatches.map((bm, idx) => {
      const winnerId = byeWinner(bm);
      return {
        _bid: bm.id,
        categoryId,
        stage,
        round: bm.round,
        matchIndex: bm.matchIndex,
        koLabel: bm.label,
        participantAId: bm.a.kind === "player" ? bm.a.playerId : null,
        participantBId: bm.b.kind === "player" ? bm.b.playerId : null,
        playOrder: startOrder + idx,
        tableNumber: ((startOrder + idx) % parallelTables) + 1,
        ...(winnerId
          ? { status: "finished" as const, winnerParticipantId: winnerId }
          : {}),
      };
    });

  const insertedRows = inserts.length
    ? await tx
        .insert(matches)
        .values(inserts.map(({ _bid: _b, ...rest }) => rest))
        .returning()
    : [];

  const bidToDbId = new Map<string, string>();
  insertedRows.forEach((row: { id: string }, i: number) => {
    bidToDbId.set(inserts[i]!._bid, row.id);
  });

  // Wire source-match references so downstream rounds know which match feeds
  // them. For bye matches that were auto-finished above, also push the bye
  // winner into the directly-downstream slot so admins see the correct
  // opponent name without manually "finishing" the walkover.
  const byeWinnerByBid = new Map<string, string>();
  for (const bm of bracketMatches) {
    const w = byeWinner(bm);
    if (w) byeWinnerByBid.set(bm.id, w);
  }

  for (const bm of bracketMatches) {
    const dbId = bidToDbId.get(bm.id);
    if (!dbId) continue;
    const update: {
      sourceMatchAId?: string;
      sourceMatchBId?: string;
      participantAId?: string;
      participantBId?: string;
    } = {};
    if (bm.a.kind === "pending") {
      const srcDb = bidToDbId.get(bm.a.fromMatchId);
      if (srcDb) update.sourceMatchAId = srcDb;
      const byeW = byeWinnerByBid.get(bm.a.fromMatchId);
      if (byeW) update.participantAId = byeW;
    }
    if (bm.b.kind === "pending") {
      const srcDb = bidToDbId.get(bm.b.fromMatchId);
      if (srcDb) update.sourceMatchBId = srcDb;
      const byeW = byeWinnerByBid.get(bm.b.fromMatchId);
      if (byeW) update.participantBId = byeW;
    }
    if (Object.keys(update).length > 0) {
      await tx.update(matches).set(update).where(eq(matches.id, dbId));
    }
  }
}

export { loadEngineGroups };
