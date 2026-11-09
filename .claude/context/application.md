# Application layer (`src/modules/<m>/application`)

## Use case

One class per directory: `use-case/<Name>UseCase/index.ts` (+ `index.test.ts`, `index.mocks.ts`). Named export, implements the base type from `@shared/application/use-case/types`:

- `UseCase<Output>` → `execute(): Promise<Output>`
- `UseCaseWithParams<Input, Output>` → `execute(params: Input): Promise<Output>`

```ts
export class UpdateUserUseCase implements UseCaseWithParams<UpdateUserInput, UpdateUserOutput> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: UpdateUserInput): Promise<UpdateUserOutput> {
    const user = await this.userRepository.getUserById(params.id);
    if (!user) throw new NotFoundException();
    ...
  }
}
```

Rules:

- Depend on repository **interfaces** via `@Inject('I…')`; other infra via shared tokens (`'IPasswordHasher'`, `'IJwtProvider'`…).
- Business rules, existence/ownership checks and error throwing happen here, not in controllers or repositories.
- Output is a plain object with only what callers need (never `passwordHash`).
- Partial updates: distinguish "absent" from "explicitly cleared" (see `UpdateUserUseCase`: `'photoUrl' in params`).
- Not decorated with `@Injectable()` in existing code (Nest resolves via `@Inject` params); keep the existing style.

## Application DTOs (`application/dto/<UseCaseName>.ts`)

Zod schema + inferred types; independent from API DTOs (those live in `src/api/<name>/v<N>/dto`).

```ts
export const UpdateUserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateUserOutput = { email: string; id: string; name: string; photoUrl?: string };
```

## Registering

Add the class to the module's `useCases` array (`providers` + `exports`) — see `user.module.ts`. Then inject it in the matching `api/<name>/v<N>/<name>.service.ts`.

## Existing use cases (user module)

`LoginByEmailUseCase` (verifies hash, signs JWT `{ user: { id } }`), `SignUpByEmailUseCase`, `FindUserByIdUseCase`, `UpdateUserUseCase`.

## Account deletion use cases (spec 024)

`user`: `UserExistsUseCase` (guard check), `ConfirmUserEmailUseCase` (404, 422 `Email does not match`, returns the stored email), `DeleteUserUseCase` (idempotent). `family`: `GetOwnedFamilyIdsUseCase`, `RemoveUserFromFamiliesUseCase` (one transaction: owned families + other memberships + pending invites to the email). `finance`: `DeleteFinanceDataByOwnerUseCase` (transactions → categories → accounts in one Prisma `$transaction`). `stock`: `DeleteStockItemsByOwnerUseCase`. **Purge-by-owner pattern:** each owned module exposes a use case `execute({ owner, ownerId }) → number` (rows deleted, idempotent) and registers it in the `OWNED_RECORDS_PURGES` list in `UserAPIModule`, next to `FAMILY_OWNED_RECORDS_CHECKS` in `FamilyAPIModule`.

## Family module use cases

`CreateFamilyUseCase` (validates name 1–50 trimmed), `GetUserFamiliesUseCase` (sorted), `GetFamilyByIdUseCase` (404 for non-members), `EnsureFamilyOwnerUseCase` (404 → 403), `UpdateFamilyUseCase`, `DeleteFamilyUseCase`, plus the exported cross-module contract composed only in `src/api`: `GetUserFamilyIdsUseCase.execute(userId) → string[]` and `CheckFamilyMembershipUseCase.execute({ userId, familyId }) → boolean`.

- `GetMonthSummaryUseCase` (spec 080): pure summary of a month from already-loaded parts (`accountRows`, `invoices`, `projections`); rules ported from the app's `getMonthSummaryUseCase` (card purchases count on their invoice month, projections only after the current month, `excludeFromTotals` skipped).

## Recurrence materialization gate (spec 081)

- `MaterializationGate` (`finance/application/service/MaterializationGate`) is an in-memory singleton provided by `FinanceModule` (not exported). `MaterializeRecurrencesUseCase` runs its body through `runOnce(ownerIds, today, task)`: owners already checked for the month of `today` within `FINANCE_MATERIALIZATION_GATE_TTL_MS` (default 60000, `0` = off) are skipped, concurrent calls with the same owner set share one run, a failed run marks nothing, and archived owners are never marked.
- Every use case that creates, changes or ends a series (or the rows it generates) calls `materializationGate.invalidate([ownerId])` after its write: `Create/Update/Delete/SplitRecurrence`, `DeleteOccurrence`, `MaterializeOccurrence`, `EndRecurrencesBySource` (account/card archive), `DeleteTransaction` (recurrence rows) and `DeleteFinanceDataByOwner`. A new use case that writes through `IFinanceRecurrenceRepository` must do the same and be listed in `scripts/materialization-gate.writes.test.ts`, which fails otherwise.

## Preloaded inputs and invoice data (spec 083)

- **One read per request:** a use case that needs data its caller usually already has takes it as an optional input instead of reading again. `preloaded: { accounts?, cards?, categories? }` (`PreloadedSchema` in `dto/FinanceCommon`) on `GetDailyBalances` (accounts and cards, unfiltered, of the same narrowed owners), `GetDashboardRows` (cards, categories), `GetProjections`, `GetTransactions`, `GetInvoicesForList`, the dashboard summary/totals and `ExpandCategoryIds`/`ResolveSearchCategoryIds` (categories). Explicit parameters, no request-scoped DI.
- **Categories:** `LoadFilterCategoriesUseCase.execute({ accessibleOwners, filter })` is the single category read of a request: `undefined` (no query) unless the filter has `categoryIds` or `q`. The top-level caller loads once (`GetDashboardSummary`, `GetFinanceTotals`, `MonthService`, `GetProjections.executeChunked` for all windows) and passes `{ categories }` down; callees do `input.preloaded?.categories ?? await loader…`.
- **Invoices:** `CreateTransaction`, `UpdateTransaction`, `MaterializeOccurrence` and `CreateRecurrence` return the `invoiceData` they computed for `overLimit`; `GetTransactions` returns `invoiceData` of the CARD period lookup (`FindInvoicesInRangeUseCase.executeWithData`); services pass it to `ResolveCardRowsPaidUseCase` (`invoiceData`, only the missing cards are computed) and `CreateInstallmentPlan` passes `card` + `invoiceData` to `GetInstallmentPlan`.
- **Families:** `GetUserFamilyAccessUseCase` also returns the name; `FinanceAccessService.resolveWithNames` gives owners and names from one read (CSV export).
- Only reuse data loaded in the same request and, for writes, after the commit.

## Transfers (spec 098)

`CreateTransferUseCase` (accounts reachable and writable by both owners via `loadWritableSides`, pure `TransferRules` errors turned into 422 by `applyTransferRules`, optional `recurrence` creates the series and the occurrences due this month through `planMaterialization`), `UpdateTransferUseCase` (patch merged over the stored transfer; archived accounts allow only `paid`/`notes`; `scope THIS_AND_NEXT` limited to amount, description and notes and applied to the later unpaid occurrences and the series template), `DeleteTransferUseCase` (`scope` required on a series occurrence; `THIS_AND_NEXT` ends the series the day before), `GetTransferUseCase` (404 unless both sides are readable) and `GetTransferLookupsUseCase` (blanks the side the caller cannot read, `counterpartHidden`). `MaterializeRecurrencesUseCase` materializes transfer series (`DueRecurrence.toAccountId`) through `IFinanceTransferRepository.materializeTransferSeries`; the generic recurrence use cases answer 404 for a transfer series. CSV: `checkTransferRows` (service `ImportTransfers`) groups rows by `Transfer ID` with the pure `TransferImport` service; the transfers are written first in one transaction.
