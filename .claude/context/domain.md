# Domain layer (`src/modules/<m>/domain`, `src/shared/domain`)

Pure TypeScript. No Nest, Prisma or npm imports.

## Entities

Plain classes with a constructor taking one params interface; fields **sorted alphabetically** (perfectionist). Default export.

```ts
interface ICategoryEntity { id: string; name: string; ... }
class CategoryEntity {
  id: string;
  name: string;
  constructor(params: ICategoryEntity) { this.id = params.id; this.name = params.name; }
}
export default CategoryEntity;
```

- Enums live next to the entity and are exported by name (`TransactionType`, `OwnerType`).
- Optional fields are `field?: T` and placed under an `// Optional fields` comment in mappers/fixtures.
- Layout: single file (`UserEntity.ts`) or directory (`CategoryEntity/index.ts`). Existing modules use the directory form; mirror the module you're in.
- Each entity has `index.test.ts`, `index.mocks.ts` and `entity/mocks/<Name>Entity.fixture.ts` (see `testing.md`).
- Ids are UUID strings (generated via `@shared/infra/uuid`). Money is currently a string (`TransactionEntity.value`), dates are ISO strings — keep consistent with the frontend contract (`integration.md`).

## Shared domain

- `OwnerEntity` / `OwnerType` (`USER` | `FAMILY`) — ownership model for finance/stock data, mirrors the frontend's `owner` + `owner_id` concept.
- `ValidationError extends BadRequestException` (`details: {code, field, message}[]`), thrown by `validate()`.

## Repository interfaces

`domain/repository/I<Name>Repository.ts` as a `type` with method signatures; exported through `index.ts`. Return entities (or `{ id }` for create), `undefined` for "not found" lookups, and take entities/param interfaces in. Methods sorted alphabetically.

```ts
export type IUserRepository = {
  createUser(params: UserEntity): Promise<{ id: string }>;
  getUserById(id: string): Promise<undefined | UserEntity>;
};
```

Existing contracts that still need an implementation: `FamilyMemberRepository` (`IFamilyRepository`, `IStockRepository` are implemented) (these use a non-`I` prefixed name; **new repositories use the `I` prefix** per `.github/copilot-instructions.md`).

## Errors

Not-found / conflict / auth errors are thrown from **use cases** as Nest HTTP exceptions (`NotFoundException`, `UnauthorizedException`, `ConflictException`…); the global `AllExceptionsFilter` maps them. Don't return error objects. Never leak internals in messages.

## Owner access input (finance)

Finance use cases take `accessibleOwners: OwnerAccess[]` (`{ owner, ownerId }`) resolved by the API service from the family module, instead of calling other modules.

Stock uses `IStockRepository` with owner-scoped methods (`findByOwners`, `existsByOwner`) and a module-local `OwnerAccess` (modules never import each other; the API service resolves the accessible owners).

## Recurring transactions (spec 034)

`RecurrenceEntity` (series template + schedule, `occurrenceCount`), `ProjectedOccurrence` (computed, never stored), `IFinanceRecurrenceRepository`. The pure domain service `RecurrenceSchedule` holds the rules: `occurrenceDate(rule, k)` (always from the start date; month-end clamping, 29 Feb), `occurrencesBetween`, `upcomingOccurrences`, `countUntil`/`totalOccurrences`, `planMaterialization` (what a series needs up to a horizon and where it ends up) and `toOccurrenceRows` (card invoice by the closing rule, moved past invoices with a payment record via `firstUnpaidInvoiceMonth`). `TransactionEntity` gains `recurrenceId`, `occurrenceNumber`, `occurrenceCount`, `recurrenceFrequency`. Use cases: `Create/Get/GetRecurrences/Update/Split/Delete` `Recurrence`, `MaterializeRecurrences` (on read, idempotent: the datasource locks the series row and `materialize` is a no-op when `last_generated_number` moved), `MaterializeOccurrence` (projected → real), `DeleteOccurrence`, `GetProjections`, `EndRecurrencesBySource` (archiving ends the series). Datasource `apply` is the one transaction behind update/split (move rows to a new series, replace rows on a frequency change, delete after a shorter end date); `removeFrom` is the one behind the delete scopes (paid rows 409, locked card rows detached or refused).

`DailyBalance` (spec 035, `domain/service/DailyBalance`): pure `buildDailyBalances({ accounts (opening), paid, pending, cardsDue, month, today })` returning one `DayBalance` per day. Paid rows count on their date; pending items (unpaid rows, projections, linked invoices) count from `max(date, today)` and never on days before `today`. `GetDailyBalancesUseCase` feeds it from `findPaidSumsFrom`/`findUnpaidSumsUntil`, the 034 projections and `ComputeCardInvoicesUseCase`.

## Category scopes (spec 038)

`CategoryEntity` has `allScopes`, `creatorId?` and `scopes: OwnerAccess[]` (a single-scope category has exactly its owner). An ALL category keeps `owner/ownerId` = the creator's Personal scope. Never compare `owner/ownerId` of a category directly: use `isVisibleTo`, `belongsToOwner`, `sameScopes`, `visibleScopes` and `categoryScopeKind` from `@finance/domain/entity/CategoryScope`.

Spec 041: `CategoryEntity.status` (`AccountStatus`, default `ACTIVE`). Archiving applies to the whole subtree; `EnsureTransactionConsistencyUseCase` takes `blockArchivedCategory` (true on create, and on updates that change the category) and `GetCategoryArchiveBlockersUseCase` lists the recurrences and running installment plans that block an archive.
