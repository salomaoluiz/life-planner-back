# Conventions, lint & workflow

## Naming (actual repo practice)

| Kind                             | Naming                                           | Example                                                   |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| Entity                           | PascalCase + `Entity`                            | `UserEntity.ts` or `CategoryEntity/index.ts`              |
| Use case                         | PascalCase + `UseCase`, dir with `index.ts`      | `SignUpByEmailUseCase/index.ts`                           |
| Application DTO                  | PascalCase (use-case name)                       | `application/dto/UpdateUser.ts`                           |
| Repository interface             | `I` + PascalCase                                 | `IUserRepository.ts`                                      |
| Repository / datasource / mapper | PascalCase dir (`<Name>Repository/index.ts`)     | `UserRepository/index.ts`, `UserMapper/index.ts`          |
| Datasource interface             | `I` + PascalCase                                 | `data/repository/datasource/IUserDatasource.ts`           |
| Controller / service / module    | kebab-case + suffix                              | `auth.controller.ts`, `user.service.ts`, `user.module.ts` |
| API DTO                          | kebab-case + `.dto.ts`                           | `update-user.dto.ts`                                      |
| Tests / mocks / fixtures         | `.test.ts` / `.mocks.ts` / `<Entity>.fixture.ts` | `index.test.ts`, `UserEntity.fixture.ts`                  |

Module folders: `user`, `family`, `finance`, `stock`. API: `src/api/<name>/v<N>`.

## ESLint / Prettier rules that bite

- **perfectionist**: object keys, interface/type members, class members, union types, named imports/exports, enum members **sorted alphabetically**. Class member order: static props → private/protected props → props → constructor → static methods → protected → private → public methods → accessors. Union types put `null`/`undefined` first (`null | User`, `undefined | UserEntity`).
- **Import groups** (blank line between, alphabetical inside): 1) builtin/external 2) test utils 3) internal aliases (`@api @auth @db @family @finance @shared @stock @user`) 4) relative (`./`).
- `no-restricted-imports`: no `../../` (use aliases); outside `src/shared/infra` external libs only via `@shared/infra` (exceptions: `zod`, `nestjs-zod`, `@nestjs/*`, `jest`, `@faker-js/*`).
- Prettier: single quotes, trailing commas `all`, print width 100, semicolons.
- TS strict, target ES6, CommonJS, decorators on. No `any`.
- Default export for entities/fixtures; named exports for use cases, controllers, services, modules, datasources, repositories.

## Workflow

- Commands: `yarn start:dev`, `yarn build`, `yarn test`, `yarn test:cov`, `yarn lint`, `yarn prettier(:fix)`, `yarn type-check`. Yarn 1.22 (`packageManager`), Node from `.nvmrc` (24.x).
- Husky: `pre-commit` → `yarn lint-staged` (lint + prettier on staged files), `yarn type-check`, related tests; `pre-push` → `yarn lint`, `yarn test --coverage`. Fix what they report; don't use `--no-verify`.
- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, optional scope e.g. `feat(user): …`).
- Docker: multi-stage `Dockerfile` (builder: `prisma generate` + build; runtime: production deps only, non-root, `prisma migrate deploy && node dist/src/main`; the Nest build output is `dist/src/main.js`), `docker-compose.yml` (staging, port 1009, env from `.env`, health check on `/api/health`) and `docker-compose.prod.yml` (production, port 1015, `SWAGGER_ENABLED=false`, backup service; every variable from the Portainer stack environment, required ones fail fast). Release flow: merge to `main` → Portainer "Pull and redeploy"; migrations must stay additive. Runbook: `docs/production.md`.
- **Secrets/personal data check before every commit** (golden rule 13 in `.claude/CLAUDE.md`): stage files by name, review `git diff --cached`. `.env` is gitignored and never staged.
- Known quirks: `format` script and `test:e2e` reference `test/` while the folder is `tests/`; `README.md` is still the Nest boilerplate; there is no `.github/workflows` yet (the frontend has `code-quality-checks.yml` to mirror).
- `.github/copilot-instructions.md` is the review-time rule set; keep it consistent with these files when patterns change.
