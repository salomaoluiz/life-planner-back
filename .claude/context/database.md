# Database (Postgres + Prisma 7)

- Schema: `prisma/schema.prisma` (generator `prisma-client`, output `generated/prisma`, `moduleFormat = "cjs"`; datasource has no `url` — the connection is built from `DB_*` in `prisma.config.ts` and, at runtime, in `Database`).
- Migrations dir: `prisma/migrations` (none committed yet). `yarn start` runs `prisma migrate deploy` first (`prestart`); the Dockerfile runs `yarn prisma generate` at build.
- Commands: `yarn prisma generate`, `yarn prisma migrate dev --name <change>` (local), `yarn prisma migrate deploy` (CI/prod). Needs `DB_*` in `.env`.

## Current models

`User { id uuid, email unique, name, password_hash, photo_url?, created_at?, updated_at? }`.

## Conventions

- Model names PascalCase, **column/field names snake_case** (matches existing `password_hash`, `photo_url`), `id String @id @default(uuid())`, `created_at DateTime? @default(now())`, `updated_at DateTime? @updatedAt`.
- Owned rows (finance, stock) follow the shared owner model: `owner` (`USER` | `FAMILY`) + `owner_id`, same naming as the frontend's Supabase tables (see `integration.md`). Prisma `enum` for fixed sets.
- Add `@@map("table_name")` / `@map` only if a table must match an existing external name; otherwise keep Prisma defaults consistent with `User`.
- Never edit a migration that was already applied/committed; add a new one.

## Changing a column — update together

Prisma schema + migration → `yarn prisma generate` → datasource payloads → mapper `toDomain`/`toPersistence` → entity (+ fixture) → application/API DTOs → tests → frontend contract (`integration.md`).

## Frontend note

The frontend's current data lives in Supabase (`../life-planner/docs/database/*.md`, with RLS, triggers and `validate_owner`). Those rules do **not** exist here: this API must enforce ownership/family-membership checks itself in use cases.
