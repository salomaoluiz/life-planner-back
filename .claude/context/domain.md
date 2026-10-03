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

Existing contracts that still need an implementation: `FinanceTransactionRepository`, `FamilyRepository`, `FamilyMemberRepository`, `StockRepository` (these use a non-`I` prefixed name; **new repositories use the `I` prefix** per `.github/copilot-instructions.md`).

## Errors

Not-found / conflict / auth errors are thrown from **use cases** as Nest HTTP exceptions (`NotFoundException`, `UnauthorizedException`, `ConflictException`…); the global `AllExceptionsFilter` maps them. Don't return error objects. Never leak internals in messages.
