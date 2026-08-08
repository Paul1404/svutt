# Repository guidance

This is the canonical instruction file for this repository. Claude Code loads it through
`CLAUDE.md`.

## Start here

- Inspect branch, upstream divergence, status, and diff before editing.
- Preserve pre-existing changes and keep unrelated work out of the patch.
- Use the repository's existing runtime, package manager, framework, and deployment model.
- Do not refactor an existing project into the preferred new-project stack unless explicitly requested.
- Verify current documentation before changing version-dependent dependencies or hosting behavior.

## Project

SVUTT is the SV Untereuerheim table-tennis tournament manager and public live view.

It uses Next.js, React, Hono, Drizzle, PostgreSQL, Tailwind CSS, Vitest, pnpm, Docker, and Railway.

## Project rules

- Use pnpm and preserve `pnpm-lock.yaml`.
- Do not migrate the existing Next.js and Hono architecture as unrelated cleanup.
- Keep tournament state transitions deterministic and enforce authoritative results server-side.
- Preserve public read views separately from administrative mutations.
- Generate Drizzle migrations rather than editing applied migrations.

## Commands

- `pnpm run typecheck`: TypeScript validation
- `pnpm run test`: tests
- `pnpm run build`: production build
- `pnpm run db:generate`: generate migrations

## Verification

Run the relevant checks and exercise the affected workflow, endpoint, or generated artifact.
State clearly when authenticated, database, deployment, or live verification was not possible.

## Maintaining instructions

Update `AGENTS.md` when verified, durable repository behavior changes. Keep it concise and
move detailed explanations into `docs/`. Keep `CLAUDE.md` as the compatibility import
unless Claude-specific guidance is genuinely required.
