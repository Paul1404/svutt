import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "running",
  "finished",
]);

export const matchStageEnum = pgEnum("match_stage", [
  "group",
  "ko",
  "ko_losers",
  "swiss",
]);

// Tournament format the admin picks for a category. Stored as plain text so
// adding new formats is a pure engine change without a DB migration.
export const TOURNAMENT_STRUCTURES = [
  "groups_ko",
  "round_robin",
  "round_robin_finals",
  "ko_only",
  "swiss",
] as const;
export type TournamentStructure = (typeof TOURNAMENT_STRUCTURES)[number];

export const DRAW_MODES = [
  "random",
  "seeded_snake",
  "paste_order",
  "manual",
] as const;
export type DrawMode = (typeof DRAW_MODES)[number];

export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "in_progress",
  "finished",
]);

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    location: text("location"),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
    status: tournamentStatusEnum("status").notNull().default("draft"),
    // Scheduling configuration. We track rough per-match duration (for
    // estimates and previews) and how many tables run in parallel (for
    // table assignment + estimated total duration). We do NOT schedule
    // absolute wall-clock times - matches simply run in play order.
    parallelTables: integer("parallel_tables").notNull().default(3),
    matchDurationMinutes: integer("match_duration_minutes").notNull().default(11),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("tournaments_slug_idx").on(t.slug),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // Preferred group size (4..8). Engine may deviate slightly to avoid tiny groups.
    groupSize: integer("group_size").notNull().default(4),
    // Sets needed to win a match (best of 2*n-1). 2 → Best of 3, 3 → Best of 5, etc.
    winSets: integer("win_sets").notNull().default(2),
    // Points needed to win a single set (TT default: 11).
    setPoints: integer("set_points").notNull().default(11),
    // Required lead at end of a set when scores are close (TT default: 2 → "win by 2").
    setMinLead: integer("set_min_lead").notNull().default(2),
    // Number of qualifiers per group advancing to the main bracket (default 2).
    groupAdvancementCount: integer("group_advancement_count").notNull().default(2),
    // When true, the non-qualifying group players (ranks beyond
    // groupAdvancementCount) play their own consolation bracket.
    luckyLoserEnabled: boolean("lucky_loser_enabled").notNull().default(true),
    // Tournament structure: "groups_ko" (default), "round_robin", "ko_only", "swiss".
    structure: text("structure").notNull().default("groups_ko"),
    // Draw mode: "random" (default), "seeded_snake", "manual".
    drawMode: text("draw_mode").notNull().default("random"),
    // Number of rounds for Swiss-system tournaments.
    swissRounds: integer("swiss_rounds").notNull().default(5),
    sortOrder: integer("sort_order").notNull().default(0),
    // Whether groups have been drawn (frozen). After that no more participants.
    drawDone: boolean("draw_done").notNull().default(false),
    // Whether the KO bracket has been built
    bracketDone: boolean("bracket_done").notNull().default(false),
    // Whether the category is visible on the public results page. New
    // categories start as drafts (published = false) until the admin flips
    // them; the migration backfills existing rows to true so nothing that
    // used to be visible disappears.
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tournamentIdx: index("categories_tournament_idx").on(t.tournamentId),
    slugIdx: uniqueIndex("categories_tournament_slug_idx").on(
      t.tournamentId,
      t.slug,
    ),
  }),
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    club: text("club"),
    seed: integer("seed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    categoryIdx: index("participants_category_idx").on(t.categoryId),
  }),
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // "A", "B", "C", ...
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (t) => ({
    categoryIdx: index("groups_category_idx").on(t.categoryId),
    labelIdx: uniqueIndex("groups_category_label_idx").on(t.categoryId, t.label),
  }),
);

// M-to-N: participant ↔ group (one participant is in exactly one group,
// but we use a join table to keep things flexible and to express "not yet assigned").
export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 1..groupSize
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.participantId] }),
    participantIdx: uniqueIndex("group_members_participant_idx").on(
      t.participantId,
    ),
  }),
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    stage: matchStageEnum("stage").notNull(),
    // For group matches
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    round: integer("round").notNull(), // group: round-robin round; ko: bracket round (0 = first)
    matchIndex: integer("match_index").notNull(), // ordering within round/category
    // Participant A / B. Nullable for KO matches that are awaiting upstream winners.
    participantAId: uuid("participant_a_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    participantBId: uuid("participant_b_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    // For KO: references to upstream matches whose winner fills this slot.
    sourceMatchAId: uuid("source_match_a_id"),
    sourceMatchBId: uuid("source_match_b_id"),
    // Label for display ("Viertelfinale", "Halbfinale", "Finale")
    koLabel: text("ko_label"),
    status: matchStatusEnum("status").notNull().default("pending"),
    // Cached result (denormalized for performance; engine is source of truth)
    setsA: integer("sets_a").notNull().default(0),
    setsB: integer("sets_b").notNull().default(0),
    winnerParticipantId: uuid("winner_participant_id").references(
      () => participants.id,
      { onDelete: "set null" },
    ),
    // Scheduling. We only track table number and play order - absolute
    // wall-clock times are intentionally not persisted.
    tableNumber: integer("table_number"),
    playOrder: integer("play_order"), // global order across the category for scheduling
    // Admin-only UI hint: marks a group-phase match as "already played" even
    // when no result has been entered yet. Pure visual signal, no game logic
    // depends on it.
    played: boolean("played").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    categoryIdx: index("matches_category_idx").on(t.categoryId),
    groupIdx: index("matches_group_idx").on(t.groupId),
    stageIdx: index("matches_stage_idx").on(t.categoryId, t.stage),
  }),
);

export const matchSets = pgTable(
  "match_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(), // 1..3
    pointsA: integer("points_a").notNull(),
    pointsB: integer("points_b").notNull(),
  },
  (t) => ({
    matchIdx: index("match_sets_match_idx").on(t.matchId),
    uniqueSet: uniqueIndex("match_sets_unique_idx").on(t.matchId, t.setNumber),
  }),
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(), // just 'admin' for now
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -------- Relations --------

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [categories.tournamentId],
    references: [tournaments.id],
  }),
  participants: many(participants),
  groups: many(groups),
  matches: many(matches),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  category: one(categories, {
    fields: [participants.categoryId],
    references: [categories.id],
  }),
  memberships: many(groupMembers),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  category: one(categories, {
    fields: [groups.categoryId],
    references: [categories.id],
  }),
  members: many(groupMembers),
  matches: many(matches),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  participant: one(participants, {
    fields: [groupMembers.participantId],
    references: [participants.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  category: one(categories, {
    fields: [matches.categoryId],
    references: [categories.id],
  }),
  group: one(groups, {
    fields: [matches.groupId],
    references: [groups.id],
  }),
  participantA: one(participants, {
    fields: [matches.participantAId],
    references: [participants.id],
    relationName: "matchParticipantA",
  }),
  participantB: one(participants, {
    fields: [matches.participantBId],
    references: [participants.id],
    relationName: "matchParticipantB",
  }),
  sets: many(matchSets),
}));

export const matchSetsRelations = relations(matchSets, ({ one }) => ({
  match: one(matches, {
    fields: [matchSets.matchId],
    references: [matches.id],
  }),
}));

// -------- Type exports --------

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchSetRow = typeof matchSets.$inferSelect;
export type Session = typeof sessions.$inferSelect;

// Keep an unused import warning-free in some tsc setups
export { sql, jsonb };
