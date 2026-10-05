# Frontend ↔ Backend integration

Two sibling repos (expected layout: both folders under the same parent):

| Repo                | Path (from this repo) | Stack                                      | Router                              |
| ------------------- | --------------------- | ------------------------------------------ | ----------------------------------- |
| Frontend (mobile)   | `../life-planner`     | Expo 52, React Native, TS, Clean Arch      | `../life-planner/.claude/CLAUDE.md` |
| Backend (this repo) | `.`                   | NestJS 10, Prisma/Postgres, TS, Clean Arch | `.claude/CLAUDE.md`                 |

Remotes: frontend `git@github.com:salomaoluiz/life-planner.git` (https://github.com/salomaoluiz/life-planner) · backend `git@github.com:salomaoluiz/life-planner-back.git` (https://github.com/salomaoluiz/life-planner-back). If `../life-planner` doesn't exist or isn't the right repo (`git -C ../life-planner remote -v`), ask the user before cloning it as a sibling (`git clone git@github.com:salomaoluiz/life-planner.git ../life-planner`), or read the files on GitHub instead.

Read frontend files **only** when the task needs them (don't load its whole context). Never modify the frontend repo unless the user asks; instead report what must change there.

## Status

**Supabase is the legacy backend; the frontend is being migrated to this backend.** Features should be built here, and the frontend moves module by module by swapping its Supabase datasource for an API datasource (domain/use cases/UI unchanged). Until a module is migrated it keeps working on Supabase, so keep the contract compatible with the frontend's existing entities/enums, and port the rules Supabase enforced (RLS, triggers) into use cases.

The frontend currently talks to **Supabase** directly (auth with Google Sign-In, tables with RLS/triggers — `../life-planner/docs/database/`, `../life-planner/docs/ai/modules/*.md`). This backend is the new API that is being built to take over that data/auth; today only auth + user are exposed. The frontend has **not** been switched to it yet — treat any frontend consumption as planned unless you see `@infrastructure/fetcher`/datasources pointing at this API.

## Domain concept mapping

| Concept         | Frontend (`src/domain/entities`)                 | Backend (`src/modules`)                                      | Backend state                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User / auth     | `user`, `auth` (Supabase + Google)               | `user` + `api/auth/v1`, `api/user/v1` (email/password + JWT) | implemented                                                                                                                                                                                                                                                                                                                                    |
| Family          | `family`                                         | `family` (`FamilyEntity`)                                    | implemented (`/api/v1/families`; `family_name` → `name`, + `createdAt/updatedAt`)                                                                                                                                                                                                                                                              |
| Family member   | `familyMember`                                   | `family` (`FamilyMemberEntity`)                              | domain only (base table created by spec 003; features in spec 004)                                                                                                                                                                                                                                                                             |
| Finance         | `financial` (accounts, categories, transactions) | `finance` (`TransactionEntity`, `CategoryEntity`)            | accounts implemented (`/api/v1/finance/accounts`, money = integer cents); implemented (`/api/v1/finance/{accounts,categories,transactions}`). Money is integer cents (BRL implied, no currency field); transaction `date` is a calendar date; the transaction response embeds `category`/`account` summaries instead of a stored category name |
| Stock (storage) | `stock`                                          | `stock` (`StockEntity`)                                      | domain only                                                                                                                                                                                                                                                                                                                                    |
| Ownership       | `OwnerType` `USER` \| `FAMILY` + `ownerId`       | `OwnerType` / `OwnerEntity` (`@shared/domain`)               | shared enum, same values                                                                                                                                                                                                                                                                                                                       |

Keep enum **values** identical across repos (`USER`, `FAMILY`, `EXPENSE`, `INCOME`, …). Ids are UUID strings. Field names in JSON are camelCase on the API (`photoUrl`); DB columns are snake_case.

## Auth contract

- Login/signup with email: `POST /api/v1/auth/login/email` → `{ token }`; `POST /api/v1/auth/signup/email`. The token is a JWT with payload `{ user: { id } }`, lifetime `JWT_EXPIRES_IN` seconds (default 3600), no refresh token yet (recommended server config meanwhile: `JWT_EXPIRES_IN=604800`, 7 days). The app signs up with email/password, then logs in; email is normalized (trim + lowercase) server-side. Web builds need `CORS_ORIGINS` to include the app origin.
- All other endpoints: `Authorization: Bearer <token>`; 401 when missing/invalid/expired.
- Google Sign-In was dropped: the app uses email/password only (spec 002); there is no Google endpoint and none is planned.

## Cross-repo change checklist

When a backend change touches the contract (route, method, payload field, status code, error shape, enum value, id format, auth):

1. Update the endpoint table in `.claude/context/api.md` (and Swagger DTOs).
2. Tell the user which frontend files are affected: entity/enums (`../life-planner/src/domain`), model `fromJSON/toJSON` (`src/data/models`), datasource (`src/data/datasource`), DTO/use case, and `docs/ai/modules/<module>.md`.
3. Prefer additive, backward-compatible changes (new optional fields, new endpoints) while the frontend still uses Supabase.
4. If both repos are being changed in one task, do the backend first, then list/perform frontend updates as agreed with the user. Commit each repo separately.

When a **frontend** change needs new data/behavior, check here first for an existing endpoint, then follow `new-feature-slice`.

## Local dev

Backend: `yarn install`, `.env` with `DB_*`, `JWT_SECRET`, `PORT`; `yarn prisma generate`, `yarn start:dev` → `http://localhost:3000/api`, Swagger `http://localhost:3000/swagger` (docker-compose maps `1009:3000`). The mobile app must reach the host by LAN IP (not `localhost`) on a device/emulator. Any frontend base-URL setting belongs in its `.env` as an `EXPO_PUBLIC_*` placeholder in `.env.example` — never a real URL or secret in tracked files.

## Families (spec 003)

The frontend must stop creating the owner's member itself (the API does it atomically on `POST /api/v1/families`) and map `409` on delete to `FamilyHasRecords`. See `../life-planner/docs/superpowers/plans/2026-10-04-family-api-datasource.md`.
