import { z } from "zod";
import { DRAW_MODES, TOURNAMENT_STRUCTURES } from "./engine/format";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt.");

export const createTournamentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  location: z.string().trim().max(120).optional().or(z.literal("")),
  startDate: z
    .string()
    .datetime()
    .optional()
    .or(z.literal(""))
    .optional(),
  parallelTables: z.number().int().min(1).max(32).optional(),
  matchDurationMinutes: z.number().int().min(1).max(120).optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  status: z.enum(["draft", "running", "finished"]).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug,
  groupSize: z.number().int().min(3).max(8).default(4),
  winSets: z.number().int().min(1).max(4).default(2),
  setPoints: z.number().int().min(1).max(50).default(11),
  setMinLead: z.number().int().min(1).max(10).default(2),
  groupAdvancementCount: z.number().int().min(1).max(8).default(2),
  luckyLoserEnabled: z.boolean().default(true),
  structure: z.enum(TOURNAMENT_STRUCTURES).default("groups_ko"),
  drawMode: z.enum(DRAW_MODES).default("random"),
  swissRounds: z.number().int().min(1).max(20).default(5),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const addParticipantsSchema = z.object({
  /** Newline-separated, one name per line (bulk paste). */
  names: z.string().trim().min(1).max(20000),
  club: z.string().trim().max(80).optional(),
});

export const singleParticipantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  club: z.string().trim().max(80).optional(),
  seed: z.number().int().min(1).max(9999).optional(),
});

export const updateParticipantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    club: z.string().trim().max(80).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.club !== undefined, {
    message: "Mindestens ein Feld muss übergeben werden.",
  });

export const drawSchema = z.object({
  seed: z.union([z.string(), z.number()]).optional(),
});

export const swissRoundSchema = z.object({});

export const setScoreSchema = z.object({
  a: z.number().int().min(0).max(40),
  b: z.number().int().min(0).max(40),
});

export const submitResultSchema = z.object({
  sets: z.array(setScoreSchema).min(1).max(7),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

export function parseBulkNames(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length <= 120);
}
