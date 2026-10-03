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
