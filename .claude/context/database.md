# Database (Postgres + Prisma 7)

- Schema: `prisma/schema.prisma` (generator `prisma-client`, output `generated/prisma`, `moduleFormat = "cjs"`; datasource has no `url` — the connection is built from `DB_*` in `prisma.config.ts` and, at runtime, in `Database`).
- Migrations dir: `prisma/migrations` (committed: `20261004000000_baseline_user`, `20261004000100_family`). **A database that already has `"User"` (created by `db push`) must run `yarn prisma migrate resolve --applied 20261004000000_baseline_user` once before `migrate deploy` / `yarn start`.** `yarn start` runs `prisma migrate deploy` first (`prestart`); the Dockerfile runs `yarn prisma generate` at build.
- Commands: `yarn prisma generate`, `yarn prisma migrate dev --name <change>` (local), `yarn prisma migrate deploy` (CI/prod). Needs `DB_*` in `.env`.

## Current models

`User { id uuid, email unique, name, password_hash, photo_url?, created_at?, updated_at? }`.
`Family` (table `families`: `id, name, owner_id → User ON DELETE CASCADE, created_at, updated_at`) and `FamilyMember` (table `family_members`, base columns + `invite_expires_at timestamptz?` (migration `20261005000100_family_member_invites`; `invite_token` stores the **SHA-256 hex hash**, never the raw token; also unique `(family_id, user_id)`): `id, family_id → families CASCADE, email, user_id? → User CASCADE, joined_at?, invite_token? unique, created_at, updated_at`, unique `(family_id, email)`). Spec 004 may add columns in its own migration but must not redefine these. Ids and FKs are `text` holding UUID strings because `User.id` is `text`.

Enums `OwnerType` (`USER` | `FAMILY`) and `AccountStatus` (`ACTIVE` | `ARCHIVED`). `FinancialAccount` (table `financial_accounts`: `id, name, icon, balance int cents, status, owner, owner_id (no FK), created_at, updated_at`, index `(owner, owner_id)`; migration `finance_accounts`). Enum `TransactionType` (`EXPENSE` | `INCOME`) and `FinancialCategory` (`financial_categories`: name, icon, `icon_color` default `#000000`, type, `parent_id` self-FK `ON DELETE CASCADE`, `depth_level` computed by the use case, owner, owner_id; migration `finance_categories`). `FinancialTransaction` (`financial_transactions`: description, `value` int cents, `date` `@db.Date`, type, `account_id`/`category_id` FKs both `RESTRICT`, owner, owner_id, index `(owner, owner_id, date)`; migration `finance_transactions`).

Enum `StockUnit` (members declared lowercase `unit|gram|kilogram|liter|milliliter` with NO `@map`: the Prisma client validates enum args against member names, so `@map` made `create({ unit: 'liter' })` fail at runtime) and `StockItem` (`stock_items`: `id, owner, owner_id` (no FK), `description, quantity` int, `unit, brand?, barcode?, notes?, purchase_date?, opening_date?, expiration_date?` (timestamptz), `created_at, updated_at`, index `(owner, owner_id)`; migration `add_stock_items`).

## Conventions

- Model names PascalCase, **column/field names snake_case** (matches existing `password_hash`, `photo_url`), `id String @id @default(uuid())`, `created_at DateTime? @default(now())`, `updated_at DateTime? @updatedAt`.
- Money is stored as integer minor units (cents, BRL implied) in Postgres `integer`; `owner_id` of owned rows has no FK (it points to a user or a family).
- Owned rows (finance, stock) follow the shared owner model: `owner` (`USER` | `FAMILY`) + `owner_id`, same naming as the frontend's Supabase tables (see `integration.md`). Prisma `enum` for fixed sets.
- Add `@@map("table_name")` / `@map` only if a table must match an existing external name; otherwise keep Prisma defaults consistent with `User`.
- Never edit a migration that was already applied/committed; add a new one.

## Changing a column — update together

Prisma schema + migration → `yarn prisma generate` → datasource payloads → mapper `toDomain`/`toPersistence` → entity (+ fixture) → application/API DTOs → tests → frontend contract (`integration.md`).

## Frontend note

The frontend's current data lives in Supabase (`../life-planner/docs/database/*.md`, with RLS, triggers and `validate_owner`). Those rules do **not** exist here: this API must enforce ownership/family-membership checks itself in use cases.
