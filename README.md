# SVUTT — Tischtennis Turniersoftware

Open-source web app for managing table tennis tournaments end-to-end: group
draw, round-robin schedule, KO bracket (with Lucky Loser), match-time
calculation, live public view with auto-refresh.

Generic — not tied to any particular club.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Hono** for the API (one handler mounted under `/api/*`)
- **Drizzle ORM** on **PostgreSQL** (Railway / Supabase / local)
- **Tailwind CSS**
- **Zod** for validation
- **Vitest** for the engine tests
- **jose** for session cookies (HS256 JWT, HttpOnly cookie)

## Features

### Admin (single user, password from ENV)
- Create & configure tournaments (name, slug, start time, parallel tables,
  match duration)
- Create spielklassen (Herren / Damen / Jugend … — fully user-defined) with
  configurable group size (4–8) and win-sets (best of 3 / 5 …)
- Bulk-add participants (paste one name per line)
- One-click group draw → auto-generates round-robin schedule → static
  wall-clock timings per match
- Enter match results set-by-set (auto-validates table-tennis rules: 11, +2,
  deuce)
- Build the KO bracket once group stage is done
- Lucky Loser auto-promotion when `#groups` isn't a power of two
- QR-Code for the public URL

### Public View — `/t/[slug]`
- Overview of all spielklassen
- Group standings (live tie-breakers: wins → set diff → point diff →
  head-to-head for 2-way ties)
- Schedule with table number + wall-clock time
- KO bracket with pending slots
- Auto-refresh every 30 s, mobile-first

### Engine (`lib/engine/`)
Pure, framework-agnostic TypeScript — full Vitest coverage.

- `sets.ts` — set / match outcome validation (TT rules)
- `rng.ts` — deterministic Mulberry32 RNG for reproducible draws
- `draw.ts` — group shape + seeded snake draft
- `roundRobin.ts` — Berger-table round-robin scheduler
- `standings.ts` — Gruppen-Tabelle with spec-correct tie-breakers
- `bracket.ts` — KO-bracket with Lucky-Loser promotion
- `schedule.ts` — wall-clock allocator (`startTime + floor(i/tables)*dur`)

## Turnier-Logik

1. **Gruppenphase** — Jeder gegen Jeden per Gruppe. Tabelle nach: Siege →
   Satzdifferenz → Punktdifferenz → Head-to-head (bei 2-er Gleichstand) →
   Einführungsreihenfolge (stabil).
2. **Finalphase** — `nextPowerOfTwo(#groups)` Slots. Gruppensieger in
   Gruppenreihenfolge, Lücken mit besten Gruppendritten auffüllen
   (Lucky Loser). Paarung per Hälftenverfahren (Slot i vs Slot i+size/2) —
   d.h. bei 4 Gruppen: **A vs C**, **B vs D**.

### Spielmodus
- Best of 3 (default; konfigurierbar auf Best of 5).
- Satz gewonnen mit 11 Punkten + 2 Punkten Vorsprung (Einstand bis Entscheidung).
- Eingabe pro Satz: z.B. `11:3, 11:7` → 2:0, oder `11:8, 7:11, 11:9` → 2:1.

## Getting started

```bash
# 1. install
pnpm install

# 2. configure
cp .env.example .env
# edit DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET (openssl rand -hex 32)

# 3. initialise DB
pnpm db:migrate

# 4. dev
pnpm dev
# → http://localhost:3000
# admin: http://localhost:3000/admin
```

### Scripts

| Script | What |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build + serve |
| `pnpm typecheck` | Strict TS type-check |
| `pnpm test` | Run Vitest engine suite |
| `pnpm db:generate` | Drizzle Kit — generate migration from schema |
| `pnpm db:push` | Push schema to DB (dev only) |
| `pnpm db:migrate` | Apply SQL migrations from `/drizzle` |
| `pnpm db:studio` | Drizzle Studio |

## Datenmodell

```
Tournament 1───∞ Category 1───∞ Participant
                       │
                       ├───∞ Group 1───∞ GroupMember ──→ Participant
                       │
                       └───∞ Match 1───∞ MatchSet
                                │
                                └─ winner → Participant
                                └─ sourceMatchA/B → Match  (KO)
```

See [`lib/db/schema.ts`](./lib/db/schema.ts).

## API

All endpoints under `/api/*`, served by a single Hono handler
(`app/api/[[...route]]/route.ts`).

### Public (no login)
- `GET /api/public/t/:slug` — tournament overview
- `GET /api/public/t/:slug/c/:catSlug` — category with groups, standings,
  matches, sets

### Auth
- `POST /api/auth/login` `{ username, password }`
- `POST /api/auth/logout`

### Admin-only (session cookie required)
- `GET|POST /api/tournaments`
- `GET|PATCH|DELETE /api/tournaments/:id`
- `GET|POST /api/tournaments/:id/categories`
- `GET|PATCH|DELETE /api/categories/:id`
- `GET|POST /api/categories/:id/participants`
- `DELETE /api/categories/:id/participants/:participantId`
- `POST /api/categories/:id/draw`
- `POST /api/categories/:id/bracket`
- `GET /api/matches/:id`
- `PUT|DELETE /api/matches/:id/result`

## License

MIT — see [LICENSE](./LICENSE).
