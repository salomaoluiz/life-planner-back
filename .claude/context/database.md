# Database (Postgres + Prisma 7)

- Schema: `prisma/schema.prisma` (generator `prisma-client`, output `generated/prisma`, `moduleFormat = "cjs"`, `previewFeatures = ["relationJoins"]` (enables `relationLoadStrategy`, see `data.md`); datasource has no `url` — the connection is built from `DB_*` in `prisma.config.ts` and, at runtime, in `Database`).
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

Migration `transaction_paid` (spec 033): `financial_transactions.paid boolean NULL` (stored for account rows, `NULL` for card rows; CHECK `(credit_card_id IS NULL) = (paid IS NOT NULL)`), partial index `(account_id, date) WHERE paid = false` for the projected balance, existing account rows backfilled (`date <= CURRENT_DATE` → paid, system-category rows always paid) and `ledger_balance` recomputed as `initial_balance + Σ signed(paid rows)`. Rollback: drop the index, constraint and column, then recompute `ledger_balance` over all account rows (spec 028 rule).

### Recurring transactions (spec 034)

Migration `recurring_transactions`: enums `RecurrenceFrequency`, `RecurrenceStatus`; table `financial_recurrences` (`FinancialRecurrence`: template description/value/type/category, `account_id` XOR `credit_card_id` (CHECK, card ⇒ EXPENSE), `frequency`, `start_date`, `end_date` (CHECK ≥ start), `first_number`, `last_generated_number` (position inside the series), `next_occurrence_date`, `skipped_numbers int[]` (displayed occurrence numbers), `status`, owner); `financial_transactions.recurrence_id` (FK RESTRICT) / `occurrence_number` (row number = `first_number - 1 + position`) with CHECKs (both set or both null, never with an installment plan) and unique `(recurrence_id, occurrence_number)`. Index `(owner, owner_id, status, next_occurrence_date)` serves the materialization read. Generated with `prisma migrate diff` + the CHECKs appended by hand. Rollback: drop the FK columns, the table and the enums (real rows stay as normal transactions).

`financial_credit_cards.payment_account_id` (spec 035): nullable uuid FK to `financial_accounts`, `ON DELETE SET NULL`, index; migration `card_payment_account`, no backfill.

### Category scopes (spec 038)

Migration `financial_tags` (spec 043): `financial_tags (name varchar(30), owner, owner_id, all_scopes, creator_id)` with a partial unique index `(owner, owner_id, lower(name)) WHERE all_scopes = false`, `financial_tag_scopes` (like the category scopes), and the link tables `financial_transaction_tags` / `financial_recurrence_tags` (`position`, composite PK, cascade on both sides, index on `tag_id`). Installment plans carry no tags: their rows do.

Migration `category_all_scopes`: `financial_categories.all_scopes boolean default false`, `creator_id text?`, and `financial_category_scopes (category_id → financial_categories CASCADE, owner, owner_id)` unique `(category_id, owner, owner_id)`, index `(owner, owner_id)`. Single-scope rows have no scope rows; every row of an ALL tree has its own.

### Currency columns (spec 040)

`currency VARCHAR(3) NOT NULL DEFAULT 'BRL'` on `financial_accounts`, `financial_credit_cards`, `financial_transactions`, `financial_recurrences` and `financial_installment_plans` (migration `20261020000200_currency_per_transaction`). Validated in code against `SUPPORTED_CURRENCIES` (no enum); a new code needs no migration. Every transaction row equals the currency of its account/card; generated rows copy the series/plan currency. Money stays integer minor units.

Migration `archived_at` (spec 052): `financial_accounts.archived_at` and `financial_credit_cards.archived_at` `timestamptz NULL`. Set to `now()` by the update use cases on `ACTIVE → ARCHIVED`, cleared on `ARCHIVED → ACTIVE`, untouched otherwise (`archivedAtFor`). Backfill: already archived rows got `archived_at = updated_at` (approximation). The archive day is the `America/Sao_Paulo` calendar date (grouped SQL; `archivedAtFor` sets the column); the dashboard totals count a source only before it; balances use active accounts only.

## Icon catalog (spec 058)

`category_icons` is global and seeded by the migration `20261030000100_category_icons` (generated from `prisma/data/category-icons.json` by `scripts/build-category-icons-migration.mjs`). The migration creates the extensions `unaccent` and `pg_trgm` (the database role must be able to `CREATE EXTENSION`), the `IMMUTABLE` wrappers `immutable_unaccent` and `immutable_array_to_string` (generated columns need immutable functions; `array_to_string` is only stable), and the generated columns `search_text` (lowercase, unaccented text) and `search` (`tsvector`, `simple`), with a GIN index on `search` and a GIN trigram index on `search_text`. Prisma maps both as `Unsupported`; they are read with raw SQL only.

Migration `transactions_list_index` (spec 078): `financial_transactions.created_at` is `timestamptz(3)` (the page cursor is built from a JS Date, so it must not carry microseconds); raw-SQL partial index `financial_transactions_account_list_idx (owner, owner_id, date DESC, created_at DESC, id DESC) WHERE credit_card_id IS NULL` serves the account list keyset order (Prisma cannot express partial indexes: it stays out of `schema.prisma`, like `financial_transactions_unpaid_idx`; do not let `migrate dev` drop it); the redundant `financial_transactions_recurrence_id_idx` and `financial_transactions_installment_plan_id_idx` are dropped (the unique `(recurrence_id, occurrence_number)` and `(installment_plan_id, installment_number)` cover them).

Migration `upcoming_unpaid_index` (spec 082): raw-SQL partial index `financial_transactions_owner_unpaid_idx (owner, owner_id, date) WHERE paid = false` serves the unpaid read of `/finance/upcoming` (overdue has no lower date bound); like the other partial indexes it stays out of `schema.prisma`. `financial_transactions_unpaid_idx (account_id, date)` stays: the account-based unpaid reads still use it.

### Stored card invoice totals (spec 090)

Owner data versions (spec 092, migration `finance_owner_versions`): table `finance_owner_versions` (`FinanceOwnerVersion`: PK `(owner, owner_id)`, `version` bigint, `updated_at`; a missing row is version 0). **Bumped by database triggers, not by an application helper** (deviation from the spec's recommended default, so no write path can forget it): a `DEFERRABLE INITIALLY DEFERRED` row-level constraint trigger per table (`finance_bump_direct` on accounts, cards, transactions, invoice payments, recurrences, installment plans, prepayments and the category/tag scope tables; `finance_bump_category` / `finance_bump_tag` also bump every owner in the scope rows; `finance_bump_transaction_tag` / `finance_bump_recurrence_tag` bump the owner of the row). Deferred to commit and deduplicated per transaction and owner through the transaction-local setting `lp.finance_bumped`, so the version row is locked only at commit and written once per owner. Raw SQL writes (`$executeRaw`, `batchUpdate`) bump too, since the triggers sit on the tables. `scripts/owner-version.coverage.test.ts` fails when a new owned finance table has no trigger. Rollback: revert the code; the table and triggers can stay.

Migration `card_invoice_totals`: table `financial_card_invoice_totals` (`FinancialCardInvoiceTotal`: PK `(credit_card_id, invoice_month)`, FK to `financial_credit_cards` `ON DELETE CASCADE`, `income`, `expense`, `early_paid`, `purchase_count` integers, `updated_at`), backfilled by `INSERT ... SELECT ... GROUP BY` in the migration. Same aggregation as `sumCardInvoices`: every card row, no exclusions (`income` = INCOME rows, `expense` = EXPENSE rows, `early_paid` = rows of the `CARD_EARLY_PAYMENT` system category, `purchase_count` = all rows). `early_paid` is an addition to the spec's column list: `sumCardInvoices` returns it and spec 091 needs it to read the table. Shadow mode: written by the write transactions, read by nobody until spec 091. Check: `yarn perf:invoice-totals:check` (read-only, whole dev database, exit 0 in sync / 1 mismatches / 2 could not run). Rollback: revert the code; the table can stay unused or be dropped by a follow-up migration.

## Projected card purchases (spec 096)

`financial_transactions.projected` and `financial_recurrences.projected` (`boolean NOT NULL DEFAULT false`) with CHECKs: a projected row is a card EXPENSE with no installment plan, refund, prepayment or payment method; a projected series is a card EXPENSE series. `financial_card_invoice_totals` gains `projected_amount` and `projected_count`; its `income/expense/early_paid/purchase_count` count effective rows only and the row stays while `purchase_count + projected_count > 0` (`refreshCardInvoiceTotals`; `yarn perf:invoice-totals:check` compares all columns).

## Transfers (spec 098)

`financial_transfers` (CHECKs: accounts differ, `date_in >= date_out`, positive amounts/fee, notes <= 1000; account FKs `SET NULL`, recurrence FK `RESTRICT`, unique `(recurrence_id, occurrence_number)`), `financial_transactions.transfer_id` (FK `RESTRICT`, indexed; transfer rows carry no `recurrence_id`, so the series position lives on the transfer), `financial_recurrences.to_account_id` (indexed, CHECK exclusive with `credit_card_id`) and `amount_in`. The enum values were added in `20261109000100` and the categories seeded in `20261109000200` (a new enum value cannot be used in the transaction that adds it); fixed ids `…0006` (out), `…0007` (in), `…0008` (fee) mirror `SYSTEM_CATEGORY_IDS`.

## Investments (spec 102)

Migrations `20261109000400` (enum values `INVESTMENT_CONTRIBUTION`, `INVESTMENT_REDEMPTION`), `20261109000500` (tables and the two seeded system categories, ids `…0009` and `…000a`, `exclude_from_totals = true`) and `20261109000600` (trigger). Tables: `investment_assets` (partial unique `(owner, owner_id, ticker) WHERE ticker IS NOT NULL`), `investment_operations` (`quantity numeric(18,8)`, `unit_price numeric(20,8)`, CHECKs `quantity > 0`, `unit_price > 0`, `total >= 0` and `NOT generate_transaction OR account_id IS NOT NULL`; `account_id`/`transaction_id` FKs `SET NULL`, `transaction_id` unique), `investment_operation_fees` (CHECKs `amount > 0` and `kind <> 'OTHER' OR description IS NOT NULL`) and `investment_valuations` (unique `(asset_id, date)`). The `BEFORE UPDATE` trigger `investment_operations_clear_link` turns `generate_transaction` off (and clears `transaction_id`) when the FK nulls `account_id`, so deleting an account (spec 024 purge) never breaks the CHECK. The dashboard totals SQL skips categories with `exclude_from_totals`.

## Investment quotes (spec 104)

Migration `20261110000100`: enums `QuoteMarket` (`B3|US`) and `QuoteSource` (`BRAPI|FINNHUB`); market-data tables with NO owner (shared by every user): `investment_quotes` (latest quote per `(market, ticker)`: price, previous close, change %, day range, `quoted_at` = market timestamp, `fetched_at`, `last_error_at`, `missing_days`, `unavailable`), `investment_price_history` (one close per `(market, ticker, date)`, date = market calendar day), `fx_rates` (latest per pair) and `fx_rate_history` (one rate per `(pair, date)`); `investment_operations.fx_rate numeric(12,6)` (BRL per USD, CHECK `> 0`, null for BRL assets). Tracked symbols are read with raw SQL (`QuoteDatasource.findTrackedSymbols`).

Migration `20261110120000` (spec 105): enums `InvestmentFixedIncomeProduct|Liquidity|RateMode|RedemptionKind`, `InvestmentFeeKind` gains `INCOME_TAX` and `IOF` (system-only); tables `investment_fixed_income_terms` (1:1 with the asset, PK `asset_id`, CHECK `liquidity_date` only for `GRACE_PERIOD`, index on `maturity_date`), `investment_fixed_income_rates` (unique `(asset_id, start_date)`, CHECK per mode on the nullable percentage columns, `effective_rate numeric(12,6)`) and `investment_fixed_income_adjustments` (unique `(asset_id, date)`, CHECK `gross_amount > 0`); `investment_operations.redemption_kind` and `net_amount` (SELL rows of calculated titles). All FKs cascade from the asset.

## Investment income (spec 107)

Migration `20261110130000`: enums `InvestmentIncomeType` (`DIVIDEND|JCP|YIELD|INTEREST|OTHER`), `InvestmentSuggestionStatus` (`PENDING|APPROVED|REJECTED|DISMISSED`) and `TransactionExternalLock` (`INVESTMENT`); `financial_transactions.external_lock` (generic, nullable: finance refuses to edit or delete such a row, `EXTERNALLY_LOCKED`). Tables: `investment_incomes` (per asset; `net_amount` integer cents mirrors the row, `transaction_id` and `suggestion_id` unique with `SET NULL`, CHECKs `quantity > 0`, `amount_per_unit > 0`, `net_amount > 0`, `notes` ≤ 1000; status is NOT stored, it is the row's `paid`), `investment_income_events` (market data without owner, unique `event_key` = source + ticker + type + ex-date) and `investment_income_suggestions` (unique `(asset_id, event_id)`, cascade from the asset and the event). Every income write runs in ONE `$transaction` with its finance row and the ledger (`IncomeDatasource.writeIncome`/`deleteIncome` through `financeLink`); `removeAssets` deletes the income rows too; operation writes recompute pending suggestion quantities (`recomputeSuggestions`).
