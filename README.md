# SVUTT — Tischtennis-Turniere · SV 1945 Untereuerheim e.V.

Web-App der Tischtennis-Abteilung des **SV 1945 Untereuerheim e.V.** zur
Verwaltung kompletter Turniere: Gruppen ziehen, Round-Robin-Spielplan,
KO-Baum (inkl. Lucky-Loser), Spielzeit-Kalkulation und öffentliche Live-Ansicht
mit automatischer Aktualisierung.

Mehr über den Verein: <https://sv-untereuerheim.de> · _Wir sind Untereuerheim_.

Der Code ist Open-Source unter MIT-Lizenz und kann von anderen Vereinen
ebenfalls genutzt werden — Logo und Vereinsnamen ggf. anpassen.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19.2**
- **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Hono** for the API (one handler mounted under `/api/*`)
- **Drizzle ORM** on **PostgreSQL** (Railway / Supabase / local)
- **Tailwind CSS v4** (CSS-first config via `@theme`)
- **Zod v4** for validation
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
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build + serve |
| `pnpm typecheck` | Strict TS type-check |
| `pnpm test` | Run Vitest suite — pure engine tests **plus** end-to-end Hono API tests on an in-process Postgres ([PGlite](https://pglite.dev)). No live DB needed. |
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

## Deployment

### Railway

The repo ships Railway-ready (`railway.json` + `railpack.json`). Builds use
[Railpack](https://railpack.com) — Railway's current default builder that
replaced the now-deprecated Nixpacks. The start command runs
`pnpm db:migrate && pnpm start`, so schema migrations are applied automatically
on every deploy.

1. **Create the project**

   ```bash
   railway init
   railway link
   ```

   Or via the dashboard: *New Project → Deploy from GitHub repo*.

2. **Add a PostgreSQL plugin** to the project (*+ New → Database → Add
   PostgreSQL*).

3. **Set variables** on the app service:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable) |
   | `ADMIN_USERNAME` | your admin login |
   | `ADMIN_PASSWORD` | strong password |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `NEXT_PUBLIC_BASE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |

   `NEXT_PUBLIC_BASE_URL` is needed at **build time**, so set it before the
   first deploy. After exposing the service (*Settings → Networking → Generate
   Domain*) Railway will populate `RAILWAY_PUBLIC_DOMAIN`.

4. **Deploy** — push to the tracked branch or run `railway up`. Railpack
   pins Node 22 + pnpm 10, installs with `pnpm install --frozen-lockfile`,
   runs `pnpm build`, then the start command applies migrations and boots
   Next.js on the port Railway provides via `$PORT`.

5. First-time admin login: `https://<your-domain>/admin`.

## License

MIT — see [LICENSE](./LICENSE).
