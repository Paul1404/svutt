<div align="center">

<img src="public/logo.png" alt="SV 1945 Untereuerheim" width="128" />

# SVUTT

**Tischtennis-Turnierverwaltung - end-to-end, in the browser.**

Groups, KO brackets, Swiss rounds, round-robin, a wall-clock scheduler and a
live public view. Built for the table-tennis section of
[SV 1945 Untereuerheim e.V.](https://sv-untereuerheim.de) - free for any club
to fork.

<br />

![Next.js 16](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19.2-149eca?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-API-ff7a00?style=flat-square&logo=hono&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-c5f74f?style=flat-square&logo=drizzle&logoColor=black)
![Postgres](https://img.shields.io/badge/Postgres-16-336791?style=flat-square&logo=postgresql&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-729b1b?style=flat-square&logo=vitest&logoColor=white)
![License MIT](https://img.shields.io/badge/License-MIT-dc2626?style=flat-square)

</div>

---

## The idea

Running a club tournament on paper is fine until someone asks "who's on table 3
next?". SVUTT takes a player list and produces everything you actually need on
match day: the draw, the schedule, the bracket, the live table, and a QR code
you can tape to the wall so nobody has to ask you anything.

It's one admin screen, one public screen, and an engine that's 100 % pure
functions - which is why the test suite runs without a database and the draws
are reproducible from a seed.

---

## What it does

### Tournament formats - pick one per Spielklasse

| Structure | What happens | Min. players |
| --- | --- | --- |
| `groups_ko` *(default)* | Round-robin groups → single-elimination KO, optionally filled with Lucky Losers | 4 |
| `round_robin`            | Everyone plays everyone, one big Tabelle, no KO | 3 |
| `ko_only`                | Straight single-elimination with seeded positioning + byes | 2 |
| `swiss`                  | N Swiss rounds (Dutch pairing, Buchholz / Sonneborn-Berger tiebreaks) | 4 |

One tournament can mix them: Herren A as `groups_ko`, Jugend as `swiss`,
Damen-Doppel as `round_robin`.

### Draw modes

- **Zufällig** - shuffled with a deterministic Mulberry32 RNG (same seed → same
  draw, which is great for replaying "wait, was that right?").
- **Gesetzt (Schlange)** - snake distribution by seed/rank so the top players
  end up spread across groups.
- **Manuell** - skip the algorithm, drop players into groups yourself.

### Scheduling

Static wall-clock allocator. You tell it *start time*, *parallel tables* and
*minutes per match*; it assigns every match a table number and a scheduled
time:

```
tableNumber  = (playOrder % tables) + 1
minuteOffset = floor(playOrder / tables) * matchDurationMinutes
wallClock    = startTime + minuteOffset
```

No live re-balancing when a match runs long - the schedule is a plan, not a
reality.

### Match input

Set-by-set: `11:3, 11:7`. The engine validates each set against table-tennis
rules (`lib/engine/sets.ts`):

- Winner needs ≥ `setPoints` (default 11) **and** a lead of ≥ `setMinLead`
  (default 2).
- Deuce: every point past the target must extend the lead by exactly the
  min-lead (12:10, 13:11, 14:12 … never 15:10).
- `winSets` determines the format - Bo3 (default), Bo5, Bo7.
- Too many sets, sets after the match is decided, or impossible scores all
  produce German error messages before anything is saved.

### Group standings - deterministic tie-breakers

Ordered strictly:

1. **Siege** (wins)
2. **Satzdifferenz** (set difference)
3. **Punktdifferenz** (point difference)
4. **Head-to-head** - only applied for exact 2-way ties
5. **Einführungsreihenfolge** - stable insertion order, so the table is
   deterministic even when everything else is equal

### KO bracket

- Group winners seeded A, B, C, … into a bracket of `nextPowerOfTwo(#groups)`
  slots.
- Gaps filled with **Lucky Losers** - best Gruppendritten ranked by wins → set
  diff → point diff → group label. Toggleable per Spielklasse.
- Half-split pairing: slot `i` vs slot `i + size/2`, so with 4 groups you get
  **A vs C** and **B vs D**, not A vs B.
- KO labels are localised - *Finale*, *Halbfinale*, *Viertelfinale*,
  *Achtelfinale*, *N. Runde*.
- Downstream slots auto-fill when upstream matches finish.

### Swiss system

Dutch pairing with the usual machinery:

- Score groups (wins + byes).
- Within each score group: score desc → Buchholz desc → initial seed asc.
- Top half vs bottom half, with swap-down on forced rematch.
- Odd field → lowest unbyed player gets the bye (1 point).
- Standings sort by score → Buchholz → Sonneborn-Berger → seed.
- `suggestedSwissRounds(playerCount)` picks a default round count.

### Public view (`/t/[slug]`)

- Tournament overview + per-Spielklasse status badges.
- Tables, schedule (table + wall-clock), KO bracket with pending slots.
- Auto-refresh every 30 s - pauses when the tab isn't visible.
- Mobile-first, works on the phone you taped to the scorer's table.
- Light / dark toggle, respects `prefers-reduced-motion`.

### Admin view (`/admin`)

- Single admin, password from env. No user management on purpose.
- Tournament wizard with live preview (total matches, KO size, estimated
  duration).
- Bulk participant import (paste one name per line) plus per-row edit of name,
  club, seed.
- One-click draw → schedule → bracket, with the option to redo the draw up
  until `drawDone` is set.
- QR-Code share modal with copy-to-clipboard.
- Match result dialog with inline validation and Undo-Toast.
- Keyboard-friendly: ESC closes modals, focus rings on everything.

---

## Stack

- **Next.js 16** App Router + **React 19.2**, rendered server-side with
  `dynamic = "force-dynamic"` on public pages so results show up the moment
  they're entered.
- **TypeScript** in strict mode - `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`. The engine is written as
  if the type checker is a test.
- **Hono** for the API. One handler at `app/api/[[...route]]/route.ts`, routes
  split by file.
- **Drizzle ORM** on **PostgreSQL**. Migrations in `/drizzle`, schema in
  `lib/db/schema.ts`.
- **Tailwind CSS v4** with CSS-first theming (`@theme { … }`) and hand-rolled
  utilities (`btn`, `card`, `badge-*`) so the markup stays readable.
- **Zod v4** on every request body - if it passes the schema, the handler
  trusts it.
- **jose** for HS256 session JWTs stored in an HttpOnly cookie.
- **qrcode** for the share modal.
- **Vitest 4** + **PGlite** for tests - the API suite spins up Postgres in
  Node, no Docker.

---

## Getting started

```bash
pnpm install
cp .env.example .env        # edit DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
pnpm db:migrate
pnpm dev                    # http://localhost:3000 - admin on /admin
```

`SESSION_SECRET` needs ≥ 16 characters; `openssl rand -hex 32` is the standard
incantation. In production set `NODE_ENV=production` so the session cookie
carries the `Secure` flag.

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server (Turbopack). |
| `pnpm build` / `pnpm start` | Production build + run. |
| `pnpm typecheck` | `tsc --noEmit` in strict mode. |
| `pnpm test` | Vitest - pure engine tests **and** Hono end-to-end on in-process Postgres via [PGlite](https://pglite.dev). |
| `pnpm test:watch` | Same, in watch mode. |
| `pnpm db:generate` | Generate a migration from `schema.ts`. |
| `pnpm db:push` | Push the schema to the DB (dev only). |
| `pnpm db:migrate` | Apply SQL migrations from `/drizzle`. |
| `pnpm db:studio` | Drizzle Studio. |

---

## Data model

```
Tournament ──∞ Category ──∞ Participant
                │
                ├──∞ Group ──∞ GroupMember ──→ Participant
                │
                └──∞ Match ──∞ MatchSet
                        │
                        ├─ winnerParticipant ──→ Participant
                        └─ sourceMatchA / sourceMatchB ──→ Match   (KO chaining)
```

Eight tables total: `tournaments`, `categories`, `participants`, `groups`,
`group_members`, `matches`, `match_sets`, `sessions`. Tournament format and
draw mode are plain text columns - adding a new format is an engine change, not
a migration.

See [`lib/db/schema.ts`](./lib/db/schema.ts) for the definitive shape.

---

## Engine

`lib/engine/` is pure TypeScript - no Next, no DB, no React. Import it from a
CLI, a cron, or a test; it doesn't care.

| File | Exports |
| --- | --- |
| `types.ts`           | `Player`, `SetScore`, `MatchOutcome`, `EngineMatch`, `EngineGroup`, `StandingRow`, `Bracket`, `BracketSlot`. |
| `sets.ts`            | `isValidSet`, `setWinner`, `computeMatchOutcome`, `validateMatchInput`. |
| `rng.ts`             | `createRng(seed)` - Mulberry32, plus `shuffle`. |
| `draw.ts`            | `computeGroupShape`, `drawGroups`, `orderBySeed`. |
| `roundRobin.ts`      | Berger-table round-robin scheduler. |
| `standings.ts`       | `computeStandings` with the tie-breaker chain above. |
| `bracket.ts`         | `buildBracket` (groups → KO with Lucky Losers), `nextPowerOfTwo`. |
| `koOnly.ts`          | `buildKoOnly`, `seedingOrder` for KO-only tournaments. |
| `roundRobinOnly.ts`  | Single-group round-robin builder. |
| `swiss.ts`           | `planSwissRound`, `computeSwissStandings`, `suggestedSwissRounds`. |
| `schedule.ts`        | `scheduleMatches` - the wall-clock allocator. |
| `format.ts`          | Format/draw-mode enums, German labels, min-participant constants. |

`lib/preview.ts` sits one level up and uses the engine to estimate match count,
KO size, Lucky Loser slots and total duration before the admin commits.

---

## API

All endpoints under `/api/*`, one Hono handler at
`app/api/[[...route]]/route.ts`.

**Public** - no auth.

```
GET  /api/health
GET  /api/public/t/:slug
GET  /api/public/t/:slug/c/:catSlug
```

**Auth.**

```
POST /api/auth/login     { username, password }
POST /api/auth/logout
```

**Admin** - session cookie required.

```
GET|POST            /api/tournaments
GET|PATCH|DELETE    /api/tournaments/:id
GET|POST            /api/tournaments/:id/categories

GET|PATCH|DELETE    /api/categories/:id
GET|POST            /api/categories/:id/participants
PATCH|DELETE        /api/categories/:id/participants/:pid
POST                /api/categories/:id/draw
PUT                 /api/categories/:id/groups/:gid/members
POST                /api/categories/:id/bracket
POST                /api/categories/:id/schedule
POST                /api/categories/:id/swiss-round

GET                 /api/matches/:id
PUT|DELETE          /api/matches/:id/result
```

---

## Auth

Single admin, credentials from env. On `POST /api/auth/login` the password is
compared in constant time, a HS256 JWT is signed with `SESSION_SECRET` and set
as `svutt_session` (HttpOnly, SameSite=Lax, `Secure` in production, 7-day TTL).

`middleware.ts` guards `/admin/:path*`: unauthenticated → `/admin/login`;
already-authenticated on the login page → `/admin`. The JWT signature is
re-verified on every matched request.

No user table, no sign-up, no password reset. If you lose the password, change
`ADMIN_PASSWORD` and redeploy.

---

## Testing

```
tests/
├── engine/           # pure: sets, draw, roundRobin, standings, bracket,
│                     # koOnly, roundRobinOnly, swiss, schedule, preview,
│                     # and a full-tournament integration simulation.
└── api/              # Hono + Drizzle end-to-end on PGlite.
    └── setup.ts      # spins up an in-process Postgres per test file.
```

`pnpm test` runs both. No live database, no Docker, no fixture files to keep
in sync. Seeded RNG makes draw tests deterministic.

---

## Deployment

### Railway (one-button-ish)

`railway.json` + `Dockerfile` ship with the repo.

1. *New Project → Deploy from GitHub repo.*
2. *+ New → Database → PostgreSQL.*
3. On the app service, set:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(reference variable)* |
   | `ADMIN_USERNAME` | your admin login |
   | `ADMIN_PASSWORD` | strong password |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `NEXT_PUBLIC_BASE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |

   `NEXT_PUBLIC_BASE_URL` is baked in at **build time** - set it before the
   first deploy. Expose the service first (*Settings → Networking → Generate
   Domain*) so `RAILWAY_PUBLIC_DOMAIN` is populated.

4. Deploy. The start command is `pnpm db:migrate && pnpm start`, so every
   deploy applies pending migrations automatically.

5. Visit `https://<your-domain>/admin` and log in.

### Docker (anywhere else)

Multi-stage build, Node 22 Alpine, non-root user, 3000/tcp:

```bash
docker build -t svutt .
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e ADMIN_PASSWORD=... \
  -e SESSION_SECRET=... \
  -e NEXT_PUBLIC_BASE_URL=https://your.domain \
  svutt
```

---

## Project layout

```
app/                 Next.js routes
├── page.tsx           public tournament list
├── t/[slug]/          public tournament view
├── admin/             wizard, dashboard, login
└── api/[[...route]]/  single Hono mount
components/          React - split by admin/ and public/
lib/
├── db/                Drizzle client + schema + migrations runner
├── engine/            pure tournament logic (13 modules)
├── api/               Hono routes + helpers
└── auth/              JWT session
tests/               vitest - engine + API
drizzle/             SQL migrations (0000_init, 0001_category_match_settings,
                     0002_tournament_structure)
public/              logo.png
```

---

## License

MIT - see [LICENSE](./LICENSE). Fork it, rebrand the logo (`public/logo.png`)
and the club name, run your own Vereinsmeisterschaft.
