# Life Planner Back — Claude Context Router

NestJS 10 / TypeScript (strict) REST API for the Life Planner app (families: finances, stock/home storage, family members).
Postgres via Prisma 7 (`@prisma/adapter-pg`), Zod 4 + `nestjs-zod` validation, JWT auth (bcrypt), Pino logging, Swagger at `/swagger`.
Clean Architecture / DDD: `src/api` (controllers + services) → `src/modules/<module>/application` → `src/modules/<module>/domain` ← `src/modules/<module>/data` (← `src/shared/infra`).

**Frontend repo:** `../life-planner` (Expo / React Native, sibling folder; remote `git@github.com:salomaoluiz/life-planner.git`, https://github.com/salomaoluiz/life-planner — if the folder is missing, ask the user before cloning it next to this repo, or read it on GitHub). Read `.claude/context/integration.md` whenever a change affects the API contract, auth, ids/enums or the data model — the frontend consumes this API. Its own router is `../life-planner/.claude/CLAUDE.md`.

**This file is always loaded. Everything else is loaded on demand — read ONLY the files the task needs.**

## Context map (read on demand)

| When the task involves…                                                            | Read                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Layer boundaries, module layout, DI tokens, path aliases, where a file belongs     | `.claude/context/architecture.md`                               |
| Entities, entity fixtures, repository interfaces, domain errors                    | `.claude/context/domain.md`                                     |
| Use cases, application DTOs, registering use cases in a module                     | `.claude/context/application.md`                                |
| Datasources, mappers, repository implementations, Prisma usage                     | `.claude/context/data.md`                                       |
| Controllers, services, API DTOs (Zod), routes/versioning, Swagger, auth decorators | `.claude/context/api.md`                                        |
| `src/shared/infra` wrappers (env, db, jwt, logger, hasher, uuid, validation, http) | `.claude/context/shared-infra.md`                               |
| Prisma schema, migrations, new table/column                                        | `.claude/context/database.md`                                   |
| Writing/updating tests, `*.mocks.ts`, `*.fixture.ts`                               | `.claude/context/testing.md`                                    |
| Lint rules, import order, naming, commit flow, Docker/env                          | `.claude/context/conventions.md`                                |
| Frontend ↔ backend contract, cross-repo changes, auth flow, frontend migration     | `.claude/context/integration.md`                                |
| Building a whole new feature / CRUD slice end-to-end                               | skill `new-feature-slice` (`.claude/skills/new-feature-slice/`) |

Tip: for a single-layer change read just that layer file + `conventions.md`. To see what already exists in a module, list `src/modules/<module>` instead of guessing (there is no `docs/ai` inventory in this repo yet).
Reference implementation for any new work: **`user` module** (the only one complete across all layers: entity → use cases → datasource/repository → `UserAPIModule`).

## Current state (keep updated)

- **Migration target:** this API replaces the frontend's legacy Supabase backend. New data/features belong here; port Supabase rules (RLS ownership, triggers, `validate_owner`) into use cases. See `integration.md`.
- Implemented end-to-end: `user` (find by id / me, update, login/signup by email), `auth` API, `health`, `finance` accounts, categories and transactions (`/api/v1/finance/*`, `HasFinanceDataByOwnerUseCase` wired into the family delete guard, money = integer cents), `family` (families CRUD at `/api/v1/families`; members/invites are spec 004), `stock` (items at `/api/v1/stock/items`, `HasStockItemsByOwnerUseCase` wired into the family delete guard, integer quantity, lowercase units). Auth input is normalized (email trimmed+lowercased, name 1–100, password 8–72, signup duplicate → 422 "Email already in use") and CORS is enabled via `CORS_ORIGINS`.
- Domain only (entities, fixtures, repository interfaces; **no use cases, data layer, module or controller yet**): `family` members (FamilyMember).
- Prisma schema has `User`, `Family`, `FamilyMember`, `FinancialAccount`, `FinancialCategory`, `FinancialTransaction`, `StockItem`; migrations are committed (see `database.md` for the baseline note). Other modules need models + migration before a data layer.

## Golden rules (non-negotiable)

1. **Domain is pure TS** — entities, repository interfaces and domain errors import nothing from Nest/Prisma/npm (the existing `NotFoundException`s thrown in use cases are the accepted exception, in application only).
2. **Dependency direction** — api → application → domain; data implements domain interfaces. **`src/api` is the single entrance (BFF-style)**: it only validates, calls the use cases exported by the modules and **aggregates** their results into the response — one endpoint may combine several modules (finance + stock + family) when needed, or be a plain CRUD. It holds **no business rules**: those live inside the modules (use cases/entities, extending `UseCase` / `UseCaseWithParams`), so modules never depend on each other and `api` never touches repositories/datasources. Modules export use cases only.
3. **Persistence isolation** — Prisma types (`@db/client`) appear only in `data/` (datasource, mapper). Entities are plain classes, never Prisma models; convert through a mapper.
4. **Infra libs through `@shared/infra`** — outside `src/shared/infra` don't import external libs directly (allowed: `zod`, `nestjs-zod`, `@nestjs/*`, `jest`, `@faker-js/*`). Enforced by ESLint.
5. **DI by interface token** — `@Inject('IUserRepository')`, `@Inject('IUserDatasource')`, etc.; bind with `{ provide, useClass }` in the module.
6. **Validate every input at the boundary with Zod** (`validate()` or `createZodDto` schemas). Never return `password_hash`/`passwordHash`. Protected by default (global `JwtAuthGuard`); opt out only with `@Public()`.
7. **Authorization, not just authentication** — a valid JWT is not enough: check the resource belongs to `req.user.id` (or the user's family). Known gap: `GET/PATCH /v1/user/:id` currently lets any authenticated user read/update any user; don't copy that pattern into new endpoints.
8. **Path aliases only** (`@shared/*`, `@api/*`, `@user/*`, `@finance/*`, `@family/*`, `@stock/*`, `@db/*`); never `../../`. No `any`, `@ts-ignore` or lint-disable to bypass rules.
9. **Tests are mandatory** — every use case, entity, datasource, repository, controller, service and infra wrapper gets `index.test.ts` + `index.mocks.ts` (90% global coverage threshold). Test files and fixtures use fake data only.
10. **API contract changes affect the frontend** — a changed route, payload, status code, enum or id format must be reflected in `../life-planner` (see `integration.md`). Call it out to the user; don't edit the frontend repo unless asked.
11. **Keep context in sync** — after changing a pattern, update the matching `.claude/context` file and the "Current state" section above; flag new flows/patterns so `.github/copilot-instructions.md` can be updated too.
12. **Commits & hooks** — conventional commits. Husky `pre-commit` runs `lint-staged` (lint + prettier), `type-check` and tests on staged files; `pre-push` runs `yarn lint` and `yarn test --coverage`. Fix what the hooks report; don't bypass them (`--no-verify`).
13. **Never commit secrets or personal data.** Covers `.env` contents (DB credentials, `JWT_SECRET`), tokens, keys, connection strings and real personal info (names, emails, real user/family ids, financial data).
    - Config goes in `.env` (gitignored) read through `EnvService` / `envSchema`; never hard-code values in source, tests, Docker files or docs. New variables must be added to `envSchema`, `docker-compose.yml` and, as a placeholder-only entry, to an `.env.example` (create it if missing).
    - Tests and mocks use fake data (`faker`, `test@example.com`, random UUIDs).
    - Before every commit review `git diff --cached`; stage files explicitly (no `git add -A` / `git add .`). If anything looks secret or personal, unstage it, don't commit, and tell the user. If a secret was already committed, stop and tell the user (it must be rotated); don't rewrite history yourself.
