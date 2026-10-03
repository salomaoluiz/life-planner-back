# Architecture

## Layers

```
src/
├── main.ts                  # bootstrap: URI versioning, global prefix `api`, Swagger at /swagger
├── api/                     # HTTP layer (controllers, services, API DTOs)
│   ├── api.module.ts        # imports HealthModule + V1Module
│   ├── health/              # GET /api/health (public, terminus)
│   ├── <name>/v<N>/         # NEW convention: version is the inner folder; controller uses `version: 'N'`
│   └── v1/                  # LEGACY (auth, user): v1.module.ts registers routes with RouterModule (path 'v1'); migrate to api/<name>/v1
│       ├── auth/            # auth.controller/.service/.module + dto/
│       └── user/            # user.controller/.service/.module + dto/
├── modules/                 # bounded contexts
│   ├── app.module.ts        # imports ApiModule + SharedModule
│   └── {user|family|finance|stock}/
└── shared/                  # cross-cutting
    ├── shared.module.ts     # @Global: ILogger, IJwtProvider, IPasswordHasher, Database, APP_FILTER, APP_GUARD
    ├── application/use-case/types.ts   # UseCase<Output>, UseCaseWithParams<Input, Output>
    ├── domain/              # shared entities (OwnerEntity, OwnerType) + errors (ValidationError)
    └── infra/               # env, db, jwt, logger, password-hasher, uuid, validation, http (guards/filters/decorators)
```

Dependency direction: `api → modules/*/application → modules/*/domain ← modules/*/data → shared/infra`.

**`api` is the entrance, working as a BFF**: it is deliberately separate from `modules/` so one endpoint can reach several modules at once (e.g. finance + stock + family), whether a simple CRUD or an aggregated call. Its services only call use cases exported by modules and aggregate/shape the results; they never touch repositories/datasources and hold **no business rules** (those stay in the module's use cases/entities). Domain modules must not import each other — cross-module composition happens only in `api`.

Deferred decisions (decide when the first case appears, then document here): writes spanning several modules (transaction/consistency strategy) and partial failures on aggregated reads (fail whole call vs. partial data).

## Module layout (`src/modules/<module>/`)

```
application/
  dto/<UseCase>.ts                 zod schema + Input/Output types
  use-case/<Name>UseCase/{index.ts,index.test.ts,index.mocks.ts}
domain/
  entity/<Name>Entity[/index.ts] (+ .test/.mocks) and entity/mocks/<Name>Entity.fixture.ts
  repository/I<Name>Repository.ts + index.ts (barrel)
data/                              only for modules with persistence
  datasource/<Name>Datasource/{index.ts,index.test.ts,index.mocks.ts}
  datasource/mapper/<Name>Mapper/index.ts
  repository/<Name>Repository/{index.ts,...}
  repository/datasource/I<Name>Datasource.ts   (interface the repository depends on)
<module>.module.ts
```

Request flow: `Controller` (validate, extract `req.user.id`) → `Service` (api layer; maps use-case output to API output) → `UseCase` → `I…Repository` → `…Repository` → `I…Datasource` → `…Datasource` (Prisma) → Postgres. Entities cross repository boundaries; Prisma rows cross only datasource↔mapper.

## Wiring a module (see `user.module.ts`)

- `providers`: the use cases + `{ provide: 'I<Name>Repository', useClass }` + `{ provide: 'I<Name>Datasource', useClass }`.
- `exports`: the use cases only.
- An `api/<name>/<name>.module.ts` (new convention) imports the domain module(s) and declares the controllers + services of each version in `api/<name>/v<N>/`; import it in `ApiModule`. Legacy `api/v1/<name>/` modules are registered in `v1.module.ts` with `RouterModule` (`path: 'v1'`) until migrated. See `api.md`.
- New domain module → add it to the aliases (see below) and, if it needs shared infra, rely on the `@Global` `SharedModule` (don't re-provide Database/Logger/JWT).

## DI tokens in use

`'ILogger'`, `'IJwtProvider'`, `'IPasswordHasher'` (shared, global) · `'IUserRepository'`, `'IUserDatasource'`, `'IPasswordHasherRepository'` (user module). Interface type + string token with the same name.

## Path aliases (tsconfig.json AND jest.config.js `moduleNameMapper` AND `eslint/rules/constants.mjs`)

`@/*`→`src/*` · `@shared/*` · `@api/*` · `@user/*`, `@family/*`, `@finance/*`, `@stock/*` → `src/modules/<x>/*` · `@auth/*`→`src/modules/auth/*` (reserved, folder doesn't exist) · `@db/*`→`generated/prisma/*` (Prisma client; generated, gitignored — run `yarn prisma generate`).

Adding a new module alias = update **all three** places (tsconfig `paths`, jest `moduleNameMapper`, `internalModules` in `eslint/rules/constants.mjs`), otherwise lint, tests or build break.

## Where does it go?

| New thing                           | Location                                             |
| ----------------------------------- | ---------------------------------------------------- |
| Business rule / orchestration       | `modules/<m>/application/use-case/<Name>UseCase/`    |
| Concept with identity/invariants    | `modules/<m>/domain/entity/`                         |
| Persistence contract                | `modules/<m>/domain/repository/I<Name>Repository.ts` |
| Prisma query                        | `modules/<m>/data/datasource/`                       |
| HTTP route, request/response schema | `api/<name>/v<N>/` (legacy: `api/v1/<name>/`)        |
| Wrapper around an npm lib           | `shared/infra/<name>/` (+ interface in `types.ts`)   |
| Used by 2+ modules, domain-level    | `shared/domain` / `shared/application`               |
