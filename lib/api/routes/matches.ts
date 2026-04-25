import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, matches, matchSets } from "@/lib/db/schema";
import { setMatchPlayedSchema, submitResultSchema } from "@/lib/validators";
import { computeMatchOutcome, validateMatchInput } from "@/lib/engine";
import { publishCategoryRevision } from "@/lib/live";
import { notFound, parseJson } from "../helpers";

export const matchRoutes = new Hono()
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);
    if (!match) return notFound(c, "Spiel");
    const sets = await db
      .select()
      .from(matchSets)
      .where(eq(matchSets.matchId, id))
      .orderBy(matchSets.setNumber);
    return c.json({ match, sets });
  })
  .put("/:id/result", async (c) => {
    const id = c.req.param("id");
    const parsed = await parseJson(c, submitResultSchema);
    if (!parsed.ok) return parsed.response;

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);
    if (!match) return notFound(c, "Spiel");

    if (!match.participantAId || !match.participantBId) {
      return c.json({ error: "Spielpaarung steht noch nicht fest." }, 400);
    }

    const [cat] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, match.categoryId))
      .limit(1);
    const winSets = cat?.winSets ?? 2;
    const rules = {
      setPoints: cat?.setPoints ?? 11,
      minLead: cat?.setMinLead ?? 2,
    };

    const errors = validateMatchInput(parsed.data.sets, winSets, rules);
    if (errors.length > 0) {
      return c.json({ error: errors.join(" ") }, 400);
    }
    const outcome = computeMatchOutcome(parsed.data.sets, winSets, rules);
    if (!outcome.winner) {
      return c.json({ error: "Kein Sieger ermittelbar." }, 400);
    }

    const winnerId =
      outcome.winner === "A" ? match.participantAId : match.participantBId;

    await db.transaction(async (tx) => {
      await tx.delete(matchSets).where(eq(matchSets.matchId, id));
      await tx
        .insert(matchSets)
        .values(
          parsed.data.sets.map((s, i) => ({
            matchId: id,
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
        .where(eq(matches.id, id));

      // Propagate winner into downstream KO matches, if any. Both the main
      // bracket and the lucky-loser bracket wire up source matches, so scan
      // either stage.
      const downstream = await tx
        .select()
        .from(matches)
        .where(
          and(
            inArray(matches.stage, ["ko", "ko_losers"] as const),
            eq(matches.categoryId, match.categoryId),
          ),
        );

      for (const d of downstream) {
        const updates: { participantAId?: string; participantBId?: string } = {};
        if (d.sourceMatchAId === id) updates.participantAId = winnerId;
        if (d.sourceMatchBId === id) updates.participantBId = winnerId;
        if (Object.keys(updates).length > 0) {
          await tx.update(matches).set(updates).where(eq(matches.id, d.id));
        }
      }
    });

    publishCategoryRevision(match.categoryId);
    return c.json({ ok: true, outcome });
  })
  .delete("/:id/result", async (c) => {
    const id = c.req.param("id");
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);
    if (!match) return notFound(c, "Spiel");
    await db.transaction(async (tx) => {
      await tx.delete(matchSets).where(eq(matchSets.matchId, id));
      await tx
        .update(matches)
        .set({
          status: "pending",
          setsA: 0,
          setsB: 0,
          winnerParticipantId: null,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, id));
      // Reset downstream KO slots that used this winner (both main and
      // lucky-loser brackets).
      if (match.winnerParticipantId) {
        const downstream = await tx
          .select()
          .from(matches)
          .where(
            and(
              inArray(matches.stage, ["ko", "ko_losers"] as const),
              eq(matches.categoryId, match.categoryId),
            ),
          );
        for (const d of downstream) {
          const updates: { participantAId?: string | null; participantBId?: string | null } = {};
          if (d.sourceMatchAId === id) updates.participantAId = null;
          if (d.sourceMatchBId === id) updates.participantBId = null;
          if (Object.keys(updates).length > 0) {
            await tx.update(matches).set(updates).where(eq(matches.id, d.id));
          }
        }
      }
    });
    publishCategoryRevision(match.categoryId);
    return c.json({ ok: true });
  })
  .put("/:id/played", async (c) => {
    const id = c.req.param("id");
    const parsed = await parseJson(c, setMatchPlayedSchema);
    if (!parsed.ok) return parsed.response;

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);
    if (!match) return notFound(c, "Spiel");
    if (match.stage !== "group") {
      return c.json(
        { error: "Played-Markierung ist nur für Gruppenspiele verfügbar." },
        400,
      );
    }

    await db
      .update(matches)
      .set({ played: parsed.data.played, updatedAt: new Date() })
      .where(eq(matches.id, id));

    publishCategoryRevision(match.categoryId);
    return c.json({ ok: true, played: parsed.data.played });
  });
