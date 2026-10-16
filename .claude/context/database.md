# Database (Postgres + Prisma 7)

- Schema: `prisma/schema.prisma` (generator `prisma-client`, output `generated/prisma`, `moduleFormat = "cjs"`; datasource has no `url` — the connection is built from `DB_*` in `prisma.config.ts` and, at runtime, in `Database`).
- Migrations dir: `prisma/migrations` (committed: `20261004000000_baseline_user`, `20261004000100_family`). **A database that already has `"User"` (created by `db push`) must run `yarn prisma migrate resolve --applied 20261004000000_baseline_user` once before `migrate deploy` / `yarn start`.** `yarn start` runs `prisma migrate deploy` first (`prestart`); the Dockerfile runs `yarn prisma generate` at build.
- Commands: `yarn prisma generate`, `yarn prisma migrate dev --name <change>` (local), `yarn prisma migrate deploy` (CI/prod). Needs `DB_*` in `.env`.

## Current models

`User { id uuid, email unique, name, password_hash, photo_url?, created_at?, updated_at? }`.
`Family` (table `families`: `id, name, owner_id → User ON DELETE CASCADE, created_at, updated_at`) and `FamilyMember` (table `family_members`, base columns + `invite_expires_at timestamptz?` (migration `20261005000100_family_member_invites`; `invite_token` stores the **SHA-256 hex hash**, never the raw token; also unique `(family_id, user_id)`): `id, family_id → families CASCADE, email, user_id? → User CASCADE, joined_at?, invite_token? unique, created_at, updated_at`, unique `(family_id, email)`). Spec 004 may add columns in its own migration but must not redefine these. Ids and FKs are `text` holding UUID strings because `User.id` is `text`.

`UserSession` (`user_sessions`, spec 027: `id, user_id → User ON DELETE CASCADE, token_hash unique` (SHA-256 of the current refresh token), `previous_token_hash? unique` (one back, accepted once as the lost-response grace), `retired_token_hash? unique` (two back, presenting it = copied token → session deleted), `device_name? varchar(100), last_used_at` (indexed, sliding idle window + purge), `rotated_at?, created_at`; migration `user_sessions`). Raw refresh tokens are never stored.

Enums `OwnerType` (`USER` | `FAMILY`) and `AccountStatus` (`ACTIVE` | `ARCHIVED`). `FinancialAccount` (table `financial_accounts`: `id, name, icon, initial_balance int cents (set on create), ledger_balance int cents (initial + every transaction, internal), status, owner, owner_id (no FK), created_at, updated_at`, index `(owner, owner_id)`; migration `finance_accounts`). Enum `TransactionType` (`EXPENSE` | `INCOME`) and `FinancialCategory` (`financial_categories`: name, icon, `icon_color` default `#000000`, type, `parent_id` self-FK `ON DELETE CASCADE`, `depth_level` computed by the use case, owner, owner_id; migration `finance_categories`). `FinancialTransaction` (`financial_transactions`: description, `value` int cents, `date` `@db.Date`, type, `account_id`/`category_id` FKs both `RESTRICT`, owner, owner_id, index `(owner, owner_id, date)`; migration `finance_transactions`).

Enum `StockUnit` (members declared lowercase `unit|gram|kilogram|liter|milliliter` with NO `@map`: the Prisma client validates enum args against member names, so `@map` made `create({ unit: 'liter' })` fail at runtime) and `StockItem` (`stock_items`: `id, owner, owner_id` (no FK), `description, quantity` int, `unit, brand?, barcode?, notes?, purchase_date?, opening_date?, expiration_date?` (timestamptz), `created_at, updated_at`, index `(owner, owner_id)`; migration `add_stock_items`).

Enum `CreditCardBrand` (`VISA|MASTERCARD|ELO|AMEX|OTHER`) and `FinancialCreditCard` (`financial_credit_cards`: `id, title, limit` int cents, `brand, closing_day/due_day` smallint, `payment_day?` smallint, `color` `#RRGGBB`, `last_digits?` char(4), `status` (reuses `AccountStatus`), `owner, owner_id` (no FK; no link to accounts), `created_at, updated_at`, index `(owner, owner_id)`; migration `finance_credit_cards`). Invoices are computed, not stored.

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

### Account balance from transactions (spec 028)

Migration `account_balance_from_transactions`: `financial_accounts.balance` becomes `initial_balance` and `ledger_balance` is recomputed from the transactions. `FinancialCategory.owner/owner_id/type` are nullable, plus `system_key` (enum `SystemCategoryKey`, unique) and `exclude_from_totals`; the CHECK `financial_categories_system_shape_check` keeps user categories fully populated and system categories owner-less and parent-less. The seed row `00000000-0000-4000-8000-000000000001` is `BALANCE_ADJUSTMENT` (mirrored by `SYSTEM_CATEGORY_IDS` in the domain). Transactions index `(account_id, date)` replaces the `account_id` index.

```sql
-- drift check: must return no rows
SELECT a.id FROM financial_accounts a
WHERE a.ledger_balance <> a.initial_balance + COALESCE((
  SELECT SUM(CASE WHEN t.type = 'INCOME' THEN t.value ELSE -t.value END)
  FROM financial_transactions t WHERE t.account_id = a.id), 0);
```

Rollback (manual, Prisma has no down step): `ALTER TABLE financial_accounts ADD COLUMN balance INTEGER NOT NULL DEFAULT 0; UPDATE financial_accounts SET balance = ledger_balance - COALESCE((SELECT SUM(CASE WHEN t.type='INCOME' THEN t.value ELSE -t.value END) FROM financial_transactions t WHERE t.account_id = financial_accounts.id AND t.date > CURRENT_DATE), 0);` then drop `initial_balance`, `ledger_balance`, the category columns/constraint/seed row and restore the `account_id` index (and `NOT NULL` on category `owner`, `owner_id`, `type` after deleting the seed row and any adjustment transactions).

### Card purchases and invoice payments (spec 029)

Migrations `invoice_payment_system_key` (enum value only: a new enum value can't be used in the transaction that adds it) and `credit_card_purchases_and_payments`. `financial_transactions.account_id` is nullable; new `credit_card_id` (FK RESTRICT) and `invoice_month` char(7) with CHECKs `num_nonnulls(account_id, credit_card_id) = 1` and `(credit_card_id IS NULL) = (invoice_month IS NULL)`, index `(credit_card_id, invoice_month)`. New table `financial_credit_card_invoice_payments` (`FinancialInvoicePayment`: unique `(credit_card_id, invoice_month)`, `amount` frozen, `paid_on`, enum `InvoicePaymentMethod` ACCOUNT|EXTERNAL, `account_id?`, unique `transaction_id?`, owner = the card's owner). Seed system category `INVOICE_PAYMENT` (`00000000-0000-4000-8000-000000000002`, type EXPENSE, `exclude_from_totals`).

### Installment plans (spec 030)

Migration `installment_plans`: table `financial_installment_plans` (`FinancialInstallmentPlan`: card and category FKs RESTRICT, `total_value` = the total of the last split, `installment_count` smallint, `date` = purchase date, owner of the card) and `financial_transactions.installment_plan_id` (FK RESTRICT) / `installment_number` smallint with CHECKs (`(plan IS NULL) = (number IS NULL)`, a plan row has `credit_card_id`) and unique `(installment_plan_id, installment_number)`. SQL generated with `prisma migrate diff --from-schema … --to-schema …` (do NOT run `migrate dev` against the shared dev DB: it asks to reset on drift); apply with `yarn prisma migrate deploy`.

### Card credits (spec 032)

Migrations `card_credit_system_keys` (enum values) and `card_credits`: table `financial_installment_prepayments` (`FinancialInstallmentPrepayment`: unique plan, `target_invoice_month`, `original_months jsonb`, unique `discount_transaction_id`, `date`, owner), columns on `financial_transactions` (`refunded_transaction_id`, `refunded_plan_id`, `prepayment_id`, `payment_method`, unique `paid_from_transaction_id`, all FKs RESTRICT), seeds `…0003` `INSTALLMENT_PREPAYMENT_DISCOUNT`, `…0004` `CARD_REFUND`, `…0005` `CARD_EARLY_PAYMENT` (type INCOME, mirrored by `SYSTEM_CATEGORY_IDS`) and CHECKs: INCOME on a card only for those three categories; `payment_method` only (and always) on early payments; `paid_from_transaction_id` iff `payment_method = 'ACCOUNT'`.
