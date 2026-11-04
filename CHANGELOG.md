# Changelog

All notable changes to this project are documented here, newest first.
Format: [Keep a Changelog](https://keepachangelog.com).

## [2.1.0] - 2026-11-03

### Added

- `GET /api/v1/finance/transactions/:id` returns one transaction (card `paid` resolved, 404 when it is missing or not readable) (spec 077).

## [2.0.0] - 2026-11-03

### Changed

- **Breaking:** `GET /api/v1/finance/transactions` requires a period (`from` + `to`, or `source=CARD` with `invoiceMonth`) and returns `{ items, nextCursor }` keyset pages (`limit` default 200, max 500, `cursor`) (spec 078).
- Transactions `created_at` keeps milliseconds; a partial index serves the account list and two redundant indexes are dropped (spec 078).

## [1.4.0] - 2026-11-03

### Added

- `GET /api/v1/user/me` also returns the user's families (`families: [{ id, name, status }]`, same order as `GET /families`), so the app resolves its owners with one call (spec 074).

## [1.3.6] - 2026-11-03

### Changed

- JSON responses of 1 KB or more are compressed (gzip, or brotli when the client accepts it); the proxy must not compress the API again (spec 072).
- Authenticated `GET` responses carry `Cache-Control: private, no-cache` (revalidated through the ETag, never stored by shared caches) (spec 072).
- CORS preflights are cached for a day (`Access-Control-Max-Age: 86400`), so browsers send one `OPTIONS` per route per day (spec 072).

## [1.3.5] - 2026-11-03

### Changed

- Bounded transaction reads (one transaction, a period, an invoice, card purchases) pin the joined relation strategy (Prisma `relationJoins` preview) so they stay one query whatever Prisma's default is (spec 071).
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
