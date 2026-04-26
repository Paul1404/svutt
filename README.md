<div align="center">

<img src="public/logo.png" alt="SV 1945 Untereuerheim" width="128" />

# SVUTT

**Tischtennis-Turnierverwaltung im Browser.**

Auslosung, Gruppen, KO, Schweizer System, Spielplan und eine öffentliche
Live-Ansicht. Gebaut für die Tischtennis-Abteilung von
[SV 1945 Untereuerheim e.V.](https://sv-untereuerheim.de). Wer einen eigenen
Verein hat, darf den Code gerne forken und das Logo austauschen.

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

## Worum es geht

Wer schon mal eine Vereinsmeisterschaft mit Zettel und Filzstift organisiert
hat, kennt die Situation: irgendwann steht jemand am Tisch und fragt "wer
spielt jetzt eigentlich an Tisch 3?". SVUTT nimmt eine Teilnehmerliste und
macht daraus alles, was am Spieltag tatsächlich gebraucht wird – Auslosung,
Spielplan, Gruppentabellen, KO-Baum, Live-Ansicht und einen QR-Code, den man
an die Halle hängen kann.

Eine Admin-Seite, eine öffentliche Seite, dazwischen eine Engine aus puren
Funktionen. Das ist der Grund, warum die Tests ohne Datenbank laufen und
warum Auslosungen aus dem Seed reproduzierbar sind.

---

## Was drin ist

### Turnierformate

Pro Spielklasse einzeln einstellbar:

| Format | Ablauf | Min. Teilnehmer |
| --- | --- | --- |
| `groups_ko` *(Standard)* | Gruppenphase im Round-Robin, danach KO. Lucky-Loser-Plätze füllen den Baum optional auf. | 4 |
| `round_robin_finals` | Eine Liga (jeder gegen jeden), die besten vier spielen Halbfinale, Finale und Spiel um Platz 3. | 4 |
| `round_robin` | Jeder gegen jeden, eine Tabelle, kein KO. | 3 |
| `ko_only` | Reines KO mit gesetzter Auslosung und Freilosen. | 2 |
| `swiss` | Schweizer System mit Buchholz/Sonneborn-Berger. | 4 |

Mischen ist erlaubt: Herren A als `groups_ko`, Jugend als `swiss`,
Damen-Doppel als `round_robin` – alles im selben Turnier.

### Auslosungsmodi

- **Zufällig** – mit deterministischem Mulberry32-RNG. Gleicher Seed →
  gleiche Auslosung. Hilft beim "Moment, war das wirklich richtig?".
- **Gesetzt (Schlange)** – Snake-Verteilung nach Setzplatz, damit die starken
  Spieler in unterschiedlichen Gruppen landen.
- **Manuell** – Algorithmus überspringen und Spieler selbst auf Gruppen
  verteilen.

### Spielplan und Tische

Der Scheduler verteilt die Spiele auf die parallelen Tische und vergibt jedem
Spiel eine Nummer. Für die Gruppenphase wird zusätzlich versucht, dass kein
Spieler in zwei aufeinanderfolgenden Slots antritt – wenn es sich vermeiden
lässt, bekommt jeder zwischen seinen Spielen eine Pause. Wenn alle übrigen
Spiele dieselben Spieler betreffen (kleine Gruppen, ein Tisch), spielt das
Format halt durch.

Jedes Spiel hat eine globale Spielnummer (`#1`, `#2`, …). Die taucht in
allen Listen, im KO-Baum und in der Live-Anzeige auf, sodass beim Aufrufen
gut "Spiel 12, Tisch 2" durch die Halle gerufen werden kann.

### Ergebniseingabe

Satz für Satz: `11:3, 11:7`. Die Engine prüft jeden Satz gegen die
Tischtennis-Regeln (`lib/engine/sets.ts`):

- Sieger braucht ≥ `setPoints` (Standard 11) **und** mindestens
  `setMinLead` Punkte Vorsprung (Standard 2).
- Bei Einstand muss jeder weitere Punkt den Vorsprung um genau den
  Mindestabstand vergrößern – also 12:10, 13:11, 14:12 …, niemals 15:10.
- `winSets` legt das Format fest – Bo3 (Standard), Bo5, Bo7.
- Zu viele Sätze, Sätze nach entschiedenem Match oder unmögliche Stände
  werden vor dem Speichern mit deutscher Fehlermeldung abgelehnt.

### Gruppentabellen

Tiebreaker laufen in dieser Reihenfolge:

1. **Siege**
2. **Satzdifferenz**
3. **Punktdifferenz**
4. **Direkter Vergleich** – nur bei genau zwei Spielern gleichauf
5. **Einführungsreihenfolge** – stabile Sortierung, damit die Tabelle
   reproduzierbar ist, wenn alles gleich ist

### KO-Baum

- Gruppensieger setzen sich auf A, B, C, … in einen Baum mit
  `nextPowerOfTwo(#Gruppen)` Plätzen.
- Lücken werden mit **Lucky Losern** gefüllt – die besten Gruppendritten,
  sortiert nach Siegen → Satzdifferenz → Punktdifferenz → Gruppenlabel.
  Pro Spielklasse ein-/ausschaltbar.
- Halbsplit-Paarung: Slot `i` gegen Slot `i + size/2`. Bei vier Gruppen
  also **A gegen C** und **B gegen D**, nicht A gegen B.
- Runden sind beschriftet: *Finale*, *Halbfinale*, *Viertelfinale*,
  *Achtelfinale*, *N. Runde*.
- Folgepartien füllen sich automatisch, sobald die Vorrundenpartie steht.

### Schweizer System

Dutch Pairing mit dem üblichen Drumherum:

- Score-Gruppen (Siege + Freilose).
- Innerhalb einer Score-Gruppe: Score absteigend → Buchholz absteigend →
  Setzplatz aufsteigend.
- Obere Hälfte gegen untere Hälfte, bei erzwungener Wiederholung wird
  durchgetauscht.
- Ungerade Teilnehmerzahl → der schwächste Spieler ohne bisheriges Freilos
  bekommt es (1 Punkt).
- Rangliste: Score → Buchholz → Sonneborn-Berger → Setzplatz.
- `suggestedSwissRounds(playerCount)` schlägt eine Rundenzahl vor.

### Öffentliche Ansicht (`/t/[slug]`)

- Übersicht über das Turnier, Statusbadges pro Spielklasse.
- Tabellen, Spielplan (Spielnummer + Tisch), KO-Baum mit offenen Plätzen.
- Lädt sich alle 30 s neu – pausiert, wenn der Tab nicht sichtbar ist, und
  bekommt zusätzlich Live-Updates per SSE, sobald ein Ergebnis eingetragen
  wurde.
- Mobile-first, läuft auf dem Handy am Schreibertisch.
- Hell-/Dunkelmodus mit Toggle, respektiert `prefers-reduced-motion`.

### Admin-Ansicht (`/admin`)

- Ein Admin, Passwort aus der Umgebung. Bewusst keine Benutzerverwaltung.
- Turnier-Wizard mit Live-Vorschau (Spielanzahl, KO-Größe, geschätzte Dauer).
- Massenimport für Teilnehmer (eine Zeile pro Name) plus Inline-Bearbeitung
  von Name, Verein, Setzplatz.
- Auslosung → Spielplan → Baum auf Knopfdruck. Solange `drawDone` nicht
  gesetzt ist, kann die Auslosung neu gewürfelt werden.
- Drag & Drop zwischen Gruppen, solange noch nichts gespielt wurde.
- "Wird gespielt"-Markierung pro Spiel, damit die Live-Spalte zeigt, was
  gerade an welchem Tisch läuft.
- Demo-Modus: Zufallsergebnisse für offene Spiele füllen, optional pro
  Phase. Praktisch für Trockenläufe.
- QR-Code-Modal mit Kopier-Knopf zum Aushang.
- Match-Result-Dialog mit Inline-Validierung und Undo-Toast.
- Tastatur-freundlich: ESC schließt Dialoge, Fokusring überall.

---

## Stack

- **Next.js 16** mit App Router und **React 19.2**, öffentliche Seiten mit
  `dynamic = "force-dynamic"`, damit Ergebnisse sofort nach dem Eintragen
  sichtbar sind.
- **TypeScript** strict – `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`. Die Engine ist so geschrieben, als wäre
  der Compiler ein Test.
- **Hono** für die API. Ein einziger Handler unter
  `app/api/[[...route]]/route.ts`, Routen sind nach Datei aufgeteilt.
- **Drizzle ORM** auf **PostgreSQL**. Migrationen in `/drizzle`, Schema in
  `lib/db/schema.ts`.
- **Tailwind CSS v4** mit CSS-First-Theming (`@theme { … }`) und
  handgemachten Utilities (`btn`, `card`, `badge-*`).
- **Zod v4** an jeder Schreib-Route. Was durchs Schema kommt, vertraut der
  Handler.
- **jose** für HS256-Session-JWTs in einem HttpOnly-Cookie.
- **qrcode** fürs Share-Modal.
- **Vitest 4** + **PGlite** für Tests – die API-Suite startet Postgres in
  Node, kein Docker nötig.

---

## Loslegen

```bash
pnpm install
cp .env.example .env        # DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET setzen
pnpm db:migrate
pnpm dev                    # http://localhost:3000 - Admin auf /admin
```

`SESSION_SECRET` muss mindestens 16 Zeichen haben; `openssl rand -hex 32`
ist die übliche Zauberformel. In Produktion `NODE_ENV=production` setzen,
damit das Session-Cookie das `Secure`-Flag bekommt.

### Skripte

| Skript | Was es tut |
| --- | --- |
| `pnpm dev` | Dev-Server (Turbopack). |
| `pnpm build` / `pnpm start` | Build und Produktionsstart. |
| `pnpm typecheck` | `tsc --noEmit` im strict-Modus. |
| `pnpm test` | Vitest – pure Engine-Tests **und** API-End-to-End auf [PGlite](https://pglite.dev). |
| `pnpm test:watch` | Dasselbe, aber mit Watch. |
| `pnpm db:generate` | Migration aus `schema.ts` erzeugen. |
| `pnpm db:push` | Schema direkt pushen (nur Dev). |
| `pnpm db:migrate` | SQL-Migrationen aus `/drizzle` ausführen. |
| `pnpm db:studio` | Drizzle Studio öffnen. |

---

## Datenmodell

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

Acht Tabellen insgesamt: `tournaments`, `categories`, `participants`,
`groups`, `group_members`, `matches`, `match_sets`, `sessions`. Format und
Auslosungsmodus sind Textspalten – ein neues Format ist eine Engine-Änderung,
keine Migration.

Die Wahrheit liegt in [`lib/db/schema.ts`](./lib/db/schema.ts).

---

## Engine

`lib/engine/` ist pures TypeScript – kein Next, keine DB, kein React.
Lässt sich aus einem CLI, einem Cron oder einem Test importieren, ohne
dass es nervt.

| Datei | Exportiert |
| --- | --- |
| `types.ts`           | `Player`, `SetScore`, `MatchOutcome`, `EngineMatch`, `EngineGroup`, `StandingRow`, `Bracket`, `BracketSlot`. |
| `sets.ts`            | `isValidSet`, `setWinner`, `computeMatchOutcome`, `validateMatchInput`. |
| `rng.ts`             | `createRng(seed)` – Mulberry32, plus `shuffle`. |
| `draw.ts`            | `computeGroupShape`, `drawGroups`, `orderBySeed`. |
| `roundRobin.ts`      | Berger-Tabelle für Round-Robin. |
| `standings.ts`       | `computeStandings` mit der Tiebreaker-Kette von oben. |
| `bracket.ts`         | `buildBracket` (Gruppen → KO mit Lucky Losern), `nextPowerOfTwo`. |
| `koOnly.ts`          | `buildKoOnly`, `seedingOrder` für reine KO-Turniere. |
| `roundRobinOnly.ts`  | Einzelgruppen-Round-Robin. |
| `swiss.ts`           | `planSwissRound`, `computeSwissStandings`, `suggestedSwissRounds`. |
| `schedule.ts`        | `scheduleMatches` (einfach) und `scheduleMatchesWithRest` (gibt Spielern Pausen zwischen ihren Spielen, wenn möglich). |
| `format.ts`          | Format-/Auslosungs-Enums, deutsche Labels, Mindestteilnehmerzahlen. |
| `randomResult.ts`    | Zufallsergebnisse für den Demo-Modus. |
| `tournamentStats.ts` | Aggregierte Statistiken fürs Admin-Dashboard. |

`lib/preview.ts` sitzt eine Ebene drüber und schätzt Spielzahl, KO-Größe,
Lucky-Loser-Plätze und Gesamtdauer, bevor der Admin auf "Anlegen" drückt.

---

## API

Alle Endpunkte unter `/api/*`, ein Hono-Handler unter
`app/api/[[...route]]/route.ts`.

**Public** – ohne Auth.

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

**Admin** – Session-Cookie nötig.

```
GET|POST            /api/tournaments
GET|PATCH|DELETE    /api/tournaments/:id
GET|POST            /api/tournaments/:id/categories

GET|PATCH|DELETE    /api/categories/:id
GET|POST            /api/categories/:id/participants
PATCH|DELETE        /api/categories/:id/participants/:pid
POST                /api/categories/:id/draw
PUT                 /api/categories/:id/groups/:gid/members
POST                /api/categories/:id/groups/move
POST                /api/categories/:id/bracket
POST                /api/categories/:id/swiss/round
POST                /api/categories/:id/populate-test-results

GET                 /api/matches/:id
PUT|DELETE          /api/matches/:id/result
PUT                 /api/matches/:id/played
```

---

## Auth

Ein Admin, Zugangsdaten aus der Umgebung. `POST /api/auth/login` vergleicht
das Passwort in konstanter Zeit, signiert ein HS256-JWT mit
`SESSION_SECRET` und setzt es als `svutt_session` (HttpOnly, SameSite=Lax,
in Produktion `Secure`, 7 Tage gültig).

`middleware.ts` schützt `/admin/:path*`: nicht eingeloggt → `/admin/login`,
schon eingeloggt auf der Login-Seite → `/admin`. Die Signatur wird bei
jedem geschützten Request neu geprüft.

Keine User-Tabelle, keine Registrierung, kein Passwort-Reset. Wer das
Passwort vergisst, ändert `ADMIN_PASSWORD` und deployt neu.

---

## Tests

```
tests/
├── engine/           # pure: sets, draw, roundRobin, standings, bracket,
│                     # koOnly, roundRobinOnly, swiss, schedule, preview,
│                     # plus eine vollständige Turnier-Simulation.
└── api/              # Hono + Drizzle gegen PGlite.
    └── setup.ts      # in-process Postgres pro Testdatei.
```

`pnpm test` zieht beides durch. Keine echte DB, kein Docker, keine
Fixture-Files. Auslosungstests sind dank Seed-RNG deterministisch.

---

## Deployment

### Railway (so ungefähr ein Knopfdruck)

`railway.json` und `Dockerfile` liegen im Repo.

1. *New Project → Deploy from GitHub repo.*
2. *+ New → Database → PostgreSQL.*
3. Auf dem App-Service folgendes setzen:

   | Variable | Wert |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(Reference Variable)* |
   | `ADMIN_USERNAME` | Admin-Login |
   | `ADMIN_PASSWORD` | starkes Passwort |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `NEXT_PUBLIC_BASE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |

   `NEXT_PUBLIC_BASE_URL` wird zur **Build-Zeit** ins Bundle gebacken –
   also vor dem ersten Deploy setzen. Vorher Service exposen
   (*Settings → Networking → Generate Domain*), damit
   `RAILWAY_PUBLIC_DOMAIN` befüllt ist.

4. Deploy. Der Start-Befehl ist `pnpm db:migrate && pnpm start`, also
   laufen Migrationen automatisch durch.

5. `https://<dein-domain>/admin` aufrufen und einloggen.

### Docker (überall sonst)

Multi-Stage-Build, Node 22 Alpine, Non-Root-User, 3000/tcp:

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

## Projektstruktur

```
app/                 Next.js-Routen
├── page.tsx           Liste der öffentlichen Turniere
├── t/[slug]/          öffentliche Turnieransicht
├── admin/             Wizard, Dashboard, Login
└── api/[[...route]]/  Hono-Mount

components/          React – getrennt nach admin/ und public/
lib/
├── db/                Drizzle-Client + Schema + Migrations-Runner
├── engine/            pure Turnierlogik
├── api/               Hono-Routen + Helfer
├── auth/              JWT-Session
├── displayName.ts     "Nachname Vorname" → "Vorname Nachname" für die UI
├── matchLabel.ts      Spielnummer + Tisch fürs Aufrufen
└── preview.ts         Vorschau-Schätzungen

tests/               Vitest – Engine + API
drizzle/             SQL-Migrationen
public/              logo.png
```

---

## Lizenz

MIT – siehe [LICENSE](./LICENSE). Forken, Logo (`public/logo.png`) und
Vereinsnamen austauschen, eigene Vereinsmeisterschaft fahren.
