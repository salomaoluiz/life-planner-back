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

### Card purchases (spec 029)

Purchase and payment writes lock the card row first (`lockCards`, `SELECT … FOR UPDATE`, ascending ids) and only then the transaction row, so a payment and a purchase on the same invoice serialize and never deadlock. Purchase create/update/delete reject a paid invoice (`assertInvoiceNotPaid`, 422). `LedgerEntry.accountId` is nullable: card purchases have no ledger effect. `FinanceInvoicePaymentDatasource.pay` re-sums the invoice inside the lock (409 when it changed) and, for ACCOUNT, creates the `INVOICE_PAYMENT` expense + ledger decrement in the same DB transaction; `undo` reverses both. `FinanceCreditCardDatasource.update` recomputes `invoice_month` of purchases in unpaid invoices when `closing_day` changes (same DB transaction). `findByOwners` default source is ACCOUNT (no card rows, no `INVOICE_PAYMENT` rows).

### Installment plans (spec 030)

`FinanceInstallmentPlanDatasource` (every write = one `$transaction` that locks the card first, then asserts with `assertInvoicesNotPaid` / `assertNoPaidInstallment`): `create` (plan + `createMany` rows), `recreate` (delete rows + recreate, old and new card locked), `updateText` (plan + all rows, no paid check), `updateFromNumber` (rows `>= n`; a `value` is refused when one is paid), `delete`. `FinanceTransactionDatasource.update` skips the paid-invoice check when only description/category change; `countByCategoryIds` also counts plans (a plan keeps its category after "Only this one" recategorizations); `deleteAllByOwner` removes plans after transactions and before cards; the card closing-day update re-assigns installments with `reassignInstallmentMonths`.

### Card credits (spec 032)

`FinancePrepaymentDatasource` (`prepay`/`undo`: card lock first, eligible rows recomputed inside the lock, `original_months` JSON for undo, the record ↔ discount-row cycle is broken before deleting) and `FinanceCardCreditDatasource` (refunds + early payments: lock card → `assertInvoiceNotPaid` → cap/net re-check inside the lock → write; an early payment from an account also writes the `INVOICE_PAYMENT` debit row and moves the ledger, `deleteCredit` removes card row first, then the debit row). `FinanceTransactionDatasource.sumCardInvoices` returns the NET per invoice (EXPENSE − INCOME) and `early_paid`; the ACCOUNT list keeps `INVOICE_PAYMENT` rows that an early payment points at. `FinanceOwnerDataDatasource` deletes referencing rows first (early payments, refunds, prepayments).

## Raw SQL: icon search (spec 058)

`FinanceCategoryIconDatasource` uses `Prisma.sql` tagged templates (parameters only, like `sumDashboardRows`): `to_tsquery('simple', 'pas:* & fol:*')` over `search`, ordered by exact name/label match, `ts_rank`, `sort`; the fallback (FTS empty and 3+ characters) uses `strict_word_similarity(text, search_text) >= 0.2` (0.3 misses transpositions such as `psata` → `pasta`). The terms come from the pure `toSearchTerms` (only `[a-z0-9]` survive, so no tsquery operator reaches SQL).
