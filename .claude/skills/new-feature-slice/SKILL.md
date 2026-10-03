---
name: new-feature-slice
description: Use when adding a new entity/CRUD feature or finishing a module in Life Planner Back that spans domain, application, data and API layers (e.g. "add transactions endpoints", "implement family module", "add categories CRUD"). Gives the ordered file checklist and which .claude/context files to read per step.
---

# New feature slice (end-to-end checklist)

Reference implementation to mirror: the **`user` module** (`src/modules/user`, `src/api/user/v1`).
Read each context file only when you reach its step. Write keys/members alphabetically (lint). Use path aliases, never `../../`.

Placeholders: `<m>` module (e.g. `finance`), `X` PascalCase entity, `x` camelCase/kebab, `<UseCase>` e.g. `CreateTransaction`.

## 0. Plan

- Confirm fields, owner model (`USER` / `FAMILY`), operations, and who may access what (ownership/family checks go in use cases).
- Skim `src/modules/<m>` (it may already have entities/repository interfaces) and `integration.md` for the frontend counterpart.

## 1. Database → `.claude/context/database.md`

- [ ] Prisma model in `prisma/schema.prisma` (snake_case fields, owner + owner_id if owned) and `yarn prisma migrate dev --name <change>`; `yarn prisma generate`.

## 2. Domain → `.claude/context/domain.md`

- [ ] `domain/entity/XEntity[/index.ts]` (+ enums) with `index.test.ts`, `index.mocks.ts`
- [ ] `domain/entity/mocks/XEntity.fixture.ts`
- [ ] `domain/repository/IXRepository.ts` + export in `domain/repository/index.ts`

## 3. Data → `.claude/context/data.md`

- [ ] `data/repository/datasource/IXDatasource.ts`
- [ ] `data/datasource/XDatasource/index.ts` (+ test, mocks)
- [ ] `data/datasource/mapper/XMapper/index.ts` (`toDomain` / `toPersistence`)
- [ ] `data/repository/XRepository/index.ts` (+ test, mocks)

## 4. Application → `.claude/context/application.md`

- [ ] `application/dto/<UseCase>.ts` (zod schema + types)
- [ ] `application/use-case/<UseCase>UseCase/{index.ts,index.test.ts,index.mocks.ts}` — ownership checks, `NotFoundException` etc.
- [ ] `<m>/<m>.module.ts`: use cases + `{ provide: 'IXRepository' }` + `{ provide: 'IXDatasource' }`, exports use cases
- [ ] Import the module in the API module (step 5). If it's a brand-new module: add the alias to `tsconfig.json`, `jest.config.js`, `eslint/rules/constants.mjs` and import in `app.module.ts` only if it's not reached via `ApiModule`.

## 5. API → `.claude/context/api.md`

- [ ] `api/<x>/v1/dto/<x>.dto.ts` (zod + `createZodDto`, `@ApiProperty` where needed)
- [ ] `api/<x>/v1/<x>.service.ts` (+ test, mocks) — maps use-case output to API output
- [ ] `api/<x>/v1/<x>.controller.ts` (+ test, mocks) — `@Controller({ path, version: '1' })`, `@ApiBearerAuth('JWT')`, `@ZodResponse`, `ParseUUIDPipe`, `req.user.id`; no `@Public()` unless intended
- [ ] `api/<x>/<x>.module.ts` (imports the domain module(s), lists controllers/services); import it in `src/api/api.module.ts` — no global `v1.module.ts`/`RouterModule`
- [ ] Update the endpoint table in `api.md`

## 6. Tests → `.claude/context/testing.md`

- [ ] Every new file above has `.test.ts` + `.mocks.ts` (success + error paths, 90% coverage). Fake data via faker.

## 7. Integration → `.claude/context/integration.md`

- [ ] Compare with the frontend entity/model; keep enum values and ids consistent.
- [ ] Report the frontend files that must change (don't edit `../life-planner` unless asked).
- [ ] Update "Current state" in `.claude/CLAUDE.md` and the mapping table in `integration.md`.

## 8. Commit → `.claude/context/conventions.md`

- [ ] Review `git diff --cached` for secrets/personal data, stage files by name, conventional commit; fix Husky failures (lint, prettier, type-check, tests).
