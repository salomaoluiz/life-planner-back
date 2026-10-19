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
| Family member   | `familyMember`                                   | `family` (`FamilyMemberEntity`)                              | implemented (`/api/v1/families/:id/members`, `/family-members/:id`, `/family-invites/:token`; `join_date → joinedAt`, role/status derived, token generated server-side and stored hashed)                                                                                                                                                      |
| Finance         | `financial` (accounts, categories, transactions) | `finance` (`TransactionEntity`, `CategoryEntity`)            | accounts implemented (`/api/v1/finance/accounts`, money = integer cents); implemented (`/api/v1/finance/{accounts,categories,transactions}`). Money is integer cents (BRL implied, no currency field); transaction `date` is a calendar date; the transaction response embeds `category`/`account` summaries instead of a stored category name |
| Stock (storage) | `stock`                                          | `stock` (`StockEntity`)                                      | implemented (`/api/v1/stock/items`; ownership resolved in the API service via the family module; integer quantity, lowercase units; family delete blocked with 409 while it owns items)                                                                                                                                                        |
| Ownership       | `OwnerType` `USER` \| `FAMILY` + `ownerId`       | `OwnerType` / `OwnerEntity` (`@shared/domain`)               | shared enum, same values                                                                                                                                                                                                                                                                                                                       |

Keep enum **values** identical across repos (`USER`, `FAMILY`, `EXPENSE`, `INCOME`, …). Ids are UUID strings. Field names in JSON are camelCase on the API (`photoUrl`); DB columns are snake_case.

## Auth contract

- Login/signup with email: `POST /api/v1/auth/login/email` (body `{ email, password, deviceName? }`) → `{ token, refreshToken, refreshTokenExpiresIn }`; `POST /api/v1/auth/signup/email`. The token is a JWT with payload `{ user: { id } }`, lifetime `JWT_EXPIRES_IN` seconds (recommended `3600`). **Sessions (spec 027):** login creates a `user_sessions` row and returns an opaque refresh token (only its SHA-256 is stored). `POST /api/v1/auth/refresh { refreshToken }` → 200 new `{ token, refreshToken, refreshTokenExpiresIn }`; the refresh token rotates on every use, the session lives while it is used at least once every `SESSION_IDLE_TTL_SECONDS` (default 172800, sliding, no absolute limit); the previous token is accepted once more if the current one was never presented (lost response), a token two generations back means a copy: the session is deleted. Every failure is `401 "Invalid or expired session"`. `POST /api/v1/auth/logout { refreshToken }` → 204 always (idempotent). Idle sessions of any user are purged on every login/refresh. Old clients ignore the new login fields. The app signs up with email/password, then logs in; email is normalized (trim + lowercase) server-side. Web builds need `CORS_ORIGINS` to include the app origin.
- All other endpoints: `Authorization: Bearer <token>`; 401 when missing/invalid/expired **or when the token's user no longer exists** (account deleted, spec 024: the `JwtAuthGuard` does one primary-key lookup per request).
- Credit cards (spec 026): `/api/v1/finance/credit-cards` (CRUD + `/overview`), money in integer cents, `InvoiceStatus` `OPEN|CLOSED|PAID`, dates `YYYY-MM-DD`, reference month `YYYY-MM`; list/overview use repeated `?ownerId=`. Cards have their own owner (USER/FAMILY) and no account link.
- `DELETE /api/v1/user/me` with `{ email }` permanently deletes the account, its USER-owned finance/stock records, the families it owns (with their FAMILY-owned records, for every member), its memberships and pending invites to its email. `204`; 422 `Email does not match`; irreversible. The frontend clears its session after a 204.
- Google Sign-In was dropped: the app uses email/password only (spec 002); there is no Google endpoint and none is planned.

## Cross-repo change checklist

When a backend change touches the contract (route, method, payload field, status code, error shape, enum value, id format, auth):

1. Update the endpoint table in `.claude/context/api.md` (and Swagger DTOs).
2. Tell the user which frontend files are affected: entity/enums (`../life-planner/src/domain`), model `fromJSON/toJSON` (`src/data/models`), datasource (`src/data/datasource`), DTO/use case, and `docs/ai/modules/<module>.md`.
3. Prefer additive, backward-compatible changes (new optional fields, new endpoints) while the frontend still uses Supabase.
4. If both repos are being changed in one task, do the backend first, then list/perform frontend updates as agreed with the user. Commit each repo separately.

When a **frontend** change needs new data/behavior, check here first for an existing endpoint, then follow `new-feature-slice`.

## Contract changes and the E2E suite

A contract change is checked by `yarn e2e`, which exercises the real app (Maestro flows in `../life-planner/e2e`) against this API. A failing flow after an intended contract change means the frontend slice is needed: stop and tell the owner (rules 10 and 14).

## Local dev

Backend: `yarn install`, `.env` with `DB_*`, `JWT_SECRET`, `PORT`; `yarn prisma generate`, `yarn start:dev` → `http://localhost:3000/api`, Swagger `http://localhost:3000/swagger` (docker-compose maps `1009:3000`). The mobile app must reach the host by LAN IP (not `localhost`) on a device/emulator. Any frontend base-URL setting belongs in its `.env` as an `EXPO_PUBLIC_*` placeholder in `.env.example` — never a real URL or secret in tracked files.

## Families (spec 003)

The frontend must stop creating the owner's member itself (the API does it atomically on `POST /api/v1/families`) and map `409` on delete to `FamilyHasRecords`. See `../life-planner/docs/superpowers/plans/2026-10-04-family-api-datasource.md`.

## Account balance from transactions (spec 028)

Contract changes: account create takes `initialBalance` (the old `balance` → `400`); account output has `initialBalance`, `balance` (current) and `projectedBalance` (end of month) and never `ledgerBalance`; `GET /accounts?today=YYYY-MM-DD`; `POST /accounts/:id/balance-adjustment?today=`; `PATCH /accounts/:id` is strict (`balance`/`initialBalance` → `400`); transaction `category` gains `systemKey` and `excludeFromTotals`; new 422 codes (`Account is archived`, `System category is reserved`, `Balance adjustments cannot be edited`, `System categories cannot be changed`). The frontend must send its local date as `today`.

### Spec 029 contract (frontend)

Transactions may have `accountId = null` and `account = null` (card purchases; the default list never returns them). New invoice endpoints and overview fields are listed in `api.md`. Errors: 422 `Invoice is paid`, 422 `Credit card is archived`, 422 `Use the invoice to change this payment`, 409 `Invoice already paid`, 409 `Credit card has transactions`. The frontend implements it in the same-numbered spec.

### Spec 030 contract (frontend)

New `/finance/installment-plans` endpoints and the `scope` field of `PATCH /transactions/:id` are in `api.md`. Transactions and invoice purchases carry `installmentPlanId`, `installmentNumber`, `installmentCount` (null outside a plan). Errors by message on 422: `Invoice is paid`, `Credit card is archived`, `An installment is in a paid invoice`, `Edit the installment plan instead`, `Delete the installment plan`. The frontend implements it in the same-numbered spec.

## Card credits (spec 032)

Invoice payloads gain `net, carryIn, total, amountDue, earlyPaid` and the detail gains `credits`; `amount` still means what is due, so spec 029/030 clients keep working. The month summary must add `earlyPaid` to `amount` (frontend `getMonthSummaryUseCase`). New endpoints: prepayment (`/installment-plans/:id/prepayment[-preview]`), refunds and early payments (`/credit-cards/:id/refunds|early-payments`), see `api.md`. New enum values `SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT | CARD_REFUND | CARD_EARLY_PAYMENT`; a card can now hold `INCOME` rows of those categories only.

Spec 033 contract: transactions gain `paid: boolean` (optional on create/update input, always present on output). The meaning of account `balance` / `projectedBalance` changed (paid rows only); ship backend and app together. Unpaid rows do not move the ledger; ledger writes go through `toLedgerEntry`/`ledgerDeltas`, which read `paid`.

## Recurring transactions (spec 034)

New contract (additive): `/finance/recurrences/*` and the `recurrenceId`/`occurrenceNumber`/`occurrenceCount`/`recurrenceFrequency` fields on transactions (see `api.md`). An app without this spec keeps working: real occurrences are normal transactions, but editing or deleting one without `scope` answers 422, so old builds cannot break a series by accident. The app sends `scope` on `PATCH`/`DELETE /transactions/:id` for recurring rows and uses `/recurrences/*` for the other scopes; the future-month list merges `GET /recurrences/projections` (client local `today`).

Spec 035 (additive): `GET /finance/accounts/daily-balances` and `paymentAccountId` / `paymentAccount` on cards. The app shows the end-of-day balance in every day header of the transactions list and prefills the invoice payment account from the card link.
