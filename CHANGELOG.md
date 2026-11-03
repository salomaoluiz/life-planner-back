# Changelog

All notable changes to this project are documented here, newest first.
Format: [Keep a Changelog](https://keepachangelog.com).

## [1.3.5] - 2026-11-03

### Changed

- Bounded transaction reads (one transaction, a period, an invoice, card purchases) load their relations in one joined query (Prisma `relationJoins` preview) instead of one query per relation (spec 071).
- Transaction lists, the CSV export and card purchases end their sort with `id`: rows with the same date and creation time now keep a fixed order (it may change once for existing ties) (spec 071).

## [1.3.4] - 2026-11-03

### Changed

- Card invoices build their chain once per card (`invoiceBuilderFor`) in the card list, invoice ranges, dashboard rows and daily balances (spec 070).
- Cards are loaded with one query (`findCreditCardsByIds`) and materialization reads due recurrences as scalars, so every finance read runs fewer queries (spec 070).

## [1.3.3] - 2026-11-02

### Added

- `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS` and `DB_STATEMENT_TIMEOUT_MS` configure the database pool (default max 20 instead of 10) (spec 069).
- The perf check records the pool waiting count of the concurrency scenario (`maxPoolWaiting`).

### Changed

- Transaction writes read the account (or card) and the category in parallel.

## [1.3.2] - 2026-11-02

### Added

- `yarn perf:check`: p50 time, response size, concurrency and `EXPLAIN` checks per module against a locally compiled API, also run by `yarn perf` (spec 066).

### Changed

- The opt-in query counter now also records bind values.
- The perf run gate accepts a remote staging database only when `PERF_DB_HOST_ALLOW` equals `DB_HOST`.

## [1.3.1] - 2026-11-02

### Added

- Opt-in SQL statement counter (`PERF_COUNT_QUERIES=1`) and `yarn perf` query-count budgets per route and module, with a route coverage test (spec 065).

### Changed

- The app setup (CORS, body limit, versioning, prefix, swagger) moved to `configureApp`, shared by `main.ts` and the perf runner; `pg` is now a direct dependency.

## [1.3.0] - 2026-10-31

### Added

- `GET /api/v1/finance/upcoming`: the overdue items (no limit) and the next days' items (default 7 days, 5 items) of unpaid account transactions, open card invoices (one item per card and month) and recurrence projections, for the app home (spec 062).

## [1.2.0] - 2026-10-30

### Added

- Optional `notes` (up to 1000 characters) on transactions, installment plans and recurring series; installments and occurrences copy the plan or series note, and system rows never have notes (spec 059).
- The `q` search of transactions, card invoices, recurrence projections and the dashboard also matches the notes, the category name (and its ancestors) and the amount (spec 059).
- The transactions CSV has a last `Notes`/`Notas` column on export and an optional `notes` field per imported row (spec 059).

## [1.1.0] - 2026-10-30

### Added

- `PATCH /api/v1/finance/categories/:id/appearance` applies icon and color to a category and its descendants in one transaction (spec 058).
- `GET /api/v1/finance/category-icons` searches a curated icon catalog in Portuguese and English, without accents, by prefix, with a typo fallback (spec 058).

## [1.0.0] - 2026-10-30

### Added

- Baseline: first versioned release.
- `GET /api/v1/version` exposes the API version and the latest released versions (spec 056).
