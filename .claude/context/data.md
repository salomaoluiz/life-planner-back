# Data layer (`src/modules/<m>/data`)

Chain: `<Name>Repository` (implements domain `I<Name>Repository`) → `I<Name>Datasource` → `<Name>Datasource` (Prisma) ; `<Name>Mapper` converts row ↔ entity.

## Datasource (`data/datasource/<Name>Datasource/index.ts`)

`@Injectable()`, injects `Database` from `@shared/infra/db/Database` and uses `this.db.client.<model>`. Takes/returns **Prisma types** (`import { User } from '@db/client'`), no entities, no business logic. Interface in `data/repository/datasource/I<Name>Datasource.ts`.

```ts
async findById(id: string): Promise<null | User> {
  return this.db.client.user.findUnique({ where: { id } });
}
```

Object keys sorted alphabetically (`data` before `where`). Prisma returns `null` for missing rows.

Relations and performance (spec 071): with the default strategy every `include` adds one SQL query per relation (one bind parameter per parent row), even when the parent returns nothing.

- A bounded read with relations (one row, one invoice, a period) passes `relationLoadStrategy: 'join'` (preview `relationJoins`): one statement. An unbounded list (whole history) and the CSV export leave it unset (Prisma 7's default is already `join`; forcing per-relation queries raised the unbounded p50 by ~25% on the perf dataset, spec 071). `relationLoadStrategyFor(source, filter)` (`data/datasource/relationLoadStrategy`) decides for the transaction list; `findById` and `findCardPurchases` always pin `'join'`.
- Lists ordered by date end with `id` as tie-breaker, so the order is stable whatever the strategy.

## Mapper (`data/datasource/mapper/<Name>Mapper/index.ts`)

Static `toDomain(raw)` and `toPersistence(entity)`. Prisma `snake_case` ⇄ entity `camelCase`; `null` ⇄ `undefined` for optionals (`raw.photo_url ?? undefined`, `photoUrl ?? null`). Timestamps (`created_at`/`updated_at`) are DB-managed — the mapper sends `null` and the datasource doesn't write them.

## Repository (`data/repository/<Name>Repository/index.ts`)

`@Injectable()`, `@Inject('I<Name>Datasource')`. Calls datasource, maps with the mapper, returns entities (`undefined` when the row is `null`). No business rules.

## Adding persistence for a module

1. Prisma model + migration (`database.md`).
2. `I<Name>Datasource` + datasource + mapper + repository (+ tests/mocks for each).
3. Provide both tokens in `<module>.module.ts`.
4. Update the frontend contract if fields are user-visible (`integration.md`).

Prisma client is generated to `generated/prisma` (gitignored); after schema changes run `yarn prisma generate` before type-check/tests.

### Atomic ledger updates (spec 028)

A write that changes money (`FinanceTransactionDatasource.create/update/delete`) runs in ONE Prisma interactive `$transaction`: update/delete first read the stored row with `SELECT … FOR UPDATE` (`data/datasource/ledger`), the domain function `ledgerDeltas(before, after)` returns the net increment per account (ascending account id, zero deltas dropped), and each account gets `ledger_balance = ledger_balance + delta` through Prisma's atomic `increment` (never read, add, write). Reads never sum the history: `FinanceAccountDatasource.findFutureSums` is one grouped `$queryRaw` over the rows dated after `today`, served by the `(account_id, date)` index; current = ledger − Σ signed(date > today), projected = ledger − Σ signed(date > end of month).

### Write transactions: minimal work under lock (spec 085)

`FinanceTransactionDatasource.create/update/delete` keep the locks for as few statements as possible:

- Inside the `$transaction` they `select` only `WRITE_SELECT` (account, owner, paid, type, value) of the written row, never the relations; the ledger and the tags need nothing else.
- Update and delete take the whole lock scope with ONE statement, `lockWriteScope` (`data/datasource/ledger`): a materialized CTE locks the cards (the stored row's card plus the one the write moves to, `ORDER BY id FOR UPDATE`) and the row select that depends on it locks the row and returns its scalars and owner. The order stays cards (ascending id) → row, the same as the invoice payment, so they never deadlock. Create has no row to lock yet and uses `lockCards`.
- The response row (`TRANSACTION_RELATIONS`, one `'join'` read through `findById`) is read AFTER the commit (`readAfterCommit`; 404 if the row vanished in between).
- Update/delete use cases check the stored row with the relation-free `findTransactionScalarsById` (`TransactionScalars`) before the write.
- `maxQueriesInTx` in `perf/budgets/finance.json` caps the statements between `BEGIN` and `COMMIT` of the three routes (create/update 15, delete 10); `perf/write-transactions.perf.test.ts` measures them and 10+10 parallel creates on one card and one account.
- Not converted yet (they lock and read in their own shapes): installment plan writes, recurrence writes, `FinanceCardCreditRepository`/`FinanceCardCreditDatasource` (refunds, early payments), `FinancePrepaymentDatasource`, `createMany`/`createImportRows`.

### Card purchases (spec 029)

Purchase and payment writes lock the card row first (`lockCards`, `SELECT … FOR UPDATE`, ascending ids) and only then the transaction row, so a payment and a purchase on the same invoice serialize and never deadlock. Purchase create/update/delete reject a paid invoice (`assertInvoiceNotPaid`, 422). `LedgerEntry.accountId` is nullable: card purchases have no ledger effect. `FinanceInvoicePaymentDatasource.pay` re-sums the invoice inside the lock (409 when it changed) and, for ACCOUNT, creates the `INVOICE_PAYMENT` expense + ledger decrement in the same DB transaction; `undo` reverses both. `FinanceCreditCardDatasource.update` recomputes `invoice_month` of purchases in unpaid invoices when `closing_day` changes (same DB transaction). `FinanceCreditCardDatasource.findByIds` / repository `findCreditCardsByIds(ids)` load several cards in one query (empty ids: no query). `FinanceRecurrenceDatasource.findDue` selects scalars only (`DueRecurrenceRow`, no relations); the repository returns `DueRecurrence` (spec 070). `findByOwners` default source is ACCOUNT (no card rows, no `INVOICE_PAYMENT` rows).

### Installment plans (spec 030)

`FinanceInstallmentPlanDatasource` (every write = one `$transaction` that locks the card first, then asserts with `assertInvoicesNotPaid` / `assertNoPaidInstallment`): `create` (plan + `createMany` rows), `recreate` (delete rows + recreate, old and new card locked), `updateText` (plan + all rows, no paid check), `updateFromNumber` (rows `>= n`; a `value` is refused when one is paid), `delete`. `FinanceTransactionDatasource.update` skips the paid-invoice check when only description/category change; `countByCategoryIds` also counts plans (a plan keeps its category after "Only this one" recategorizations); `deleteAllByOwner` removes plans after transactions and before cards; the card closing-day update re-assigns installments with `reassignInstallmentMonths`.

### Card credits (spec 032)

`FinancePrepaymentDatasource` (`prepay`/`undo`: card lock first, eligible rows recomputed inside the lock, `original_months` JSON for undo, the record ↔ discount-row cycle is broken before deleting) and `FinanceCardCreditDatasource` (refunds + early payments: lock card → `assertInvoiceNotPaid` → cap/net re-check inside the lock → write; an early payment from an account also writes the `INVOICE_PAYMENT` debit row and moves the ledger, `deleteCredit` removes card row first, then the debit row). `FinanceTransactionDatasource.sumCardInvoices` returns the NET per invoice (EXPENSE − INCOME) and `early_paid`; the ACCOUNT list keeps `INVOICE_PAYMENT` rows that an early payment points at. `FinanceOwnerDataDatasource` deletes referencing rows first (early payments, refunds, prepayments).

## Raw SQL: icon search (spec 058)

`FinanceCategoryIconDatasource` uses `Prisma.sql` tagged templates (parameters only, like `sumDashboardRows`): `to_tsquery('simple', 'pas:* & fol:*')` over `search`, ordered by exact name/label match, `ts_rank`, `sort`; the fallback (FTS empty and 3+ characters) uses `strict_word_similarity(text, search_text) >= 0.2` (0.3 misses transpositions such as `psata` → `pasta`). The terms come from the pure `toSearchTerms` (only `[a-z0-9]` survive, so no tsquery operator reaches SQL).

Transaction list keyset (spec 078): `findByOwners` takes `cursor` (`{ date, createdAt, id }`) and `limit`; it adds `date < d OR (date = d AND created_at < c) OR (date = d AND created_at = c AND id < i)` and reads `limit + 1` rows (the extra one tells a next page exists). Without `limit` it stays unbounded for the internal readers (family archive blockers, upcoming items). The cursor codec is the pure `TransactionCursor` domain service.

Upcoming reads (spec 082): `findUnpaidAccountRows(owners, to)` selects scalars only (`UnpaidAccountRowRecord`, no relations) with the ACCOUNT source rule shared with `findByOwners` (`ACCOUNT_SOURCE_WHERE`), `paid = false`, `date <= to` and `category.exclude_from_totals = false` in SQL; the repository returns `UnpaidAccountRow`. `countCardPurchases(keys)` / `countCardPurchasesByInvoice(keys)` is one `groupBy ... _count` instead of loading the purchases. `GetProjectionsUseCase.execute` loads the cards of all series once through `findCreditCardsByIds` and passes them to `project(..., cards)` (callers without the map still read one by id).

Transaction search in SQL (spec 084): `q` reaches the repository as pure `SearchTerms` (`toSearchTerms` in `TransactionSearch`: trimmed text, category ids resolved by `ResolveSearchCategoryIdsUseCase`, optional amount range). `findByOwners`/`findCardPurchases` first select the matching ids with one `$queryRaw` (`searchSql`: `foldedLike` on description and notes, `category_id IN`, `ABS(value) BETWEEN`, all parameters, plus a coarse window of owners/source/period or invoice keys), then load them with Prisma (`id IN`, the usual filters, order, keyset and `take limit + 1`). The dashboard's `sumDashboardRows` shares `searchSql`. `GetInvoicesForListUseCase` takes `purchaseCount` from `countCardPurchasesByInvoice` when a text filter is active. `perf/search-equivalence.perf.test.ts` compares the SQL result with `matchesTransactionQuery` (kept for the projections) over the 2-year window of the pinned dataset.

Batched row updates (spec 086): `batchUpdate(tx, table, keyColumn, columns, rows)` (`data/datasource/batchUpdate`) runs ONE `UPDATE ... FROM (VALUES ...)` per chunk of 500 rows (`BATCH_CHUNK_SIZE`) through `$executeRaw` with `Prisma.sql`: table and column names must match `^[a-z_][a-z0-9_]*$` (the only thing interpolated, quoted), every value is a bound parameter with an explicit cast from `BatchCast` (`char(7)`, `text`, `integer`, `boolean`, `date`; a NULL is `NULL::text`), a duplicate key or a row whose values don't match the columns throws before any statement. Used for the invoice months of a series split (`FinanceRecurrenceDatasource.patchRows`), the card closing-day reassignment (purchases and installments in one call) and the prepayment undo (`invoice_month` + `prepayment_id = NULL`). Do NOT use it for ledger increments: `UPDATE ... FROM VALUES` doesn't lock rows in a defined order, and `financial_accounts` locks stay ascending by id; per-row loops sum with `sumLedgerDeltas` (`data/datasource/ledger`: net per account, zero totals dropped, sorted by id) and apply once (`insertRows`, recurrence create, `reversalOf`).

Stored invoice totals (spec 090): EVERY write of a card row (create, update, delete, move between invoices or cards, import, refund, early payment, prepayment, installment, recurrence create/materialize/edit/remove, closing-day reassignment, owner purge) calls `refreshCardInvoiceTotals(tx, keys)` (`data/datasource/cardInvoiceTotals`) inside the same database transaction, after the card locks (cards -> rows, so the materialization and `removeFrom` lock the card first). `keys` are the (card, invoice month) pairs touched BEFORE and AFTER the write (`invoiceTotalsKeysOf(rows)` for rows in memory, `invoiceTotalsKeysWhere(tx, where)` to read them); the statement recomputes those pairs exactly from their rows (idempotent, a superset is harmless; a pair with no rows is deleted) in ONE `$executeRaw`. This replaces the spec's "apply deltas": nothing to get wrong per site except missing a pair, and the card lock serializes writers. A new writer of `financial_transactions` must call it; `scripts/card-invoice-totals.writes.test.ts` fails until the datasource is listed there. Text-only writes (category copy, installment text) and account-only rows (invoice payment debit) do not need it. Budgets: `maxQueriesInTx` of the recurrence split, the card update and the prepayment undo rose by 1-2 for the refresh.

Stored invoice totals read (spec 091): `IFinanceTransactionRepository.findInvoiceTotals(cardIds)` reads `financial_card_invoice_totals` (net = `expense - income`, `early_paid`) ordered by card and month; it replaced the whole-history grouped `sumCardInvoices` (removed, a test fails if it comes back). `ComputeCardInvoicesUseCase` is the only caller, so every route (list, invoices, dashboard, daily balances, upcoming, month endpoint) reads the table. Run `yarn perf:invoice-totals:check` before a PR that touches a card-row write.

## Transfers (spec 098)

`FinanceTransferDatasource`: every write is ONE `$transaction`; accounts locked with `lockAccounts` (ascending id) and the transfer row with `FOR UPDATE`; rows are planned by `planRows` (out on the origin, in on the destination only once `amount_in` is known, fee on the destination dated with the in side) and reconciled by category on edit; ledger deltas are summed per account (`sumLedgerDeltas`) and applied once. `createSeries`, `materializeSeries` (locks the series row and checks `expected_last`), `deleteSeriesFrom`, `createMany` (CSV) and `updateSeriesTemplate` share `insertTransfer`. `findByOwners` on recurrences takes `transfers: 'EXCLUDE' | 'ALL' | 'ONLY'` (default `EXCLUDE`) and its `account_id` filter matches the origin OR the destination of a transfer series.

## External lock and linked income rows (spec 107)

`financial_transactions.external_lock` (`TransactionExternalLock`) is set only by the investment datasource when it writes the finance row of an income (`IncomeDatasource.writeIncome`); finance reads it as a scalar (`TransactionEntity.externalLock`, `TransactionScalars.externalLock`) and `UpdateTransactionUseCase`/`DeleteTransactionUseCase` answer `422 { code: EXTERNALLY_LOCKED }` before any other check on such a row. CSV import never sets it. Unlike the 102 operation rows (guarded by their system category), income rows use a normal user INCOME category.
