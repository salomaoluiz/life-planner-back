# API layer (`src/api`)

## Bootstrapping (`src/main.ts`)

Global prefix `api`, URI versioning, Swagger UI at `/swagger` (bearer scheme named `JWT`). Final URLs: `/api/v1/<controller path>/...`, health at `/api/health`. Port from `PORT` (default 3000; docker-compose publishes `1009:3000`).

## Folder & versioning convention: `api/<name>/v<N>/`

**New endpoints** live in `src/api/<name>/v1/` (version is the **inner** folder), so a breaking change to one resource adds `src/api/<name>/v2/` without creating an empty global `v2` tree for everything else. The public URL is unchanged: `/api/v<N>/<name>`.

- Version is declared on the controller: `@Controller({ path: '<name>', version: '1' })` (URI versioning is already enabled in `main.ts`). **Do not** register new modules in `RouterModule`/`v1.module.ts`.
- Each `api/<name>/` has its own `<name>.module.ts` (e.g. `api/user/user.module.ts`) that imports the domain module(s) and lists the controllers/services of every version; import it directly in `ApiModule` (`src/api/api.module.ts`).
- A new version copies only what changes (DTOs/controller/service of that resource); unchanged endpoints stay in the old version folder and keep working. Mark the old version deprecated (`@ApiOperation({ deprecated: true })`) and note it in the endpoint table before removing it.
- All resources (`auth`, `user`) already use this layout; there is no `v1.module.ts`/`RouterModule` any more. Never add a global `api/v1/<name>/` folder.

## Controller + service pairs (`api/<name>/v<N>/`)

```
api/<name>/
├── <name>.module.ts                    # one per resource, covers all its versions
└── v1/
    ├── <name>.controller.ts (+ .test.ts, .mocks.ts)
    ├── <name>.service.ts    (+ .test.ts, .mocks.ts)
    └── dto/<kebab-name>.dto.ts
```

- **Controller**: routing, input validation, extracting `req.user.id`, response typing. No business logic. Class decorators: `@Controller({ path: 'user', version: '1' })`, `@ApiBearerAuth('JWT')` on protected controllers.
- **Service** (`@Injectable()`): calls use cases exported by one **or several** modules and aggregates/maps their outputs to the API output shape. This is the only api-layer class that knows use cases. Aggregation only — no business rules, no repository/datasource access; if a rule is needed, add/extend a use case in the owning module. Don't make modules import each other to avoid composing here.
- An API module imports every domain module whose use cases it needs. Cross-module writes and partial-failure handling on aggregated reads are intentionally **not defined yet**; ask the user before building the first such endpoint.
- Register: import the `api/<name>` module in `ApiModule`.

## DTOs (Zod)

Zod schema → `createZodDto(schema)` classes for input/output, exported as `<Thing>Input` / `<Thing>Output` (auth DTOs use `...ApiInput/ApiOutput/ApiSchema` + explicit `validate()` in the controller). Use `@ApiProperty` where Swagger can't infer (e.g. optional fields). Responses: `@ZodResponse({ status: 200, type: XOutput })`.

```ts
const UpdateUserInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  photoUrl: z.url().optional(),
});
export class UpdateUserInput extends createZodDto(UpdateUserInputSchema) {}
```

Path params: `@Param('id', ParseUUIDPipe)`.

## Auth

- Global `JwtAuthGuard` (APP_GUARD): requires `Authorization: Bearer <jwt>`; sets `request.user = { id }` from the token. Opt out with `@Public()` (`@shared/infra/http/decorators/Public`) — only login, signup, health today.
- Current user in a handler: `@Request() req: JwtPayload & Request` → `req.user.id`.
- Prefer `/me`-style routes or compare `:id` with `req.user.id` / the user's family membership; don't expose other users' data by raw id.

## Existing endpoints

| Method | Path                                                     | Auth   | Notes                                                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                                            | public | terminus                                                                                                                                                                                                                                                                                  |
| POST   | `/api/v1/auth/login/email`                               | public | `{ email, password, deviceName? }` (deviceName trimmed, max 100) → `201 { token, refreshToken, refreshTokenExpiresIn }` (Nest default POST status); email trimmed+lowercased; password 1–72; `401 "Invalid Credentials"` for unknown email or wrong password                              |
| POST   | `/api/v1/auth/refresh`                                   | public | `{ refreshToken }` → `200 { token, refreshToken, refreshTokenExpiresIn }`; rotates the refresh token; `400` invalid body; `401 "Invalid or expired session"` for unknown/idle/reused token or missing user (same message always)                                                          |
| POST   | `/api/v1/auth/logout`                                    | public | `{ refreshToken }` → `204` always for a valid body (unknown token included); `400` invalid body                                                                                                                                                                                           |
| POST   | `/api/v1/auth/signup/email`                              | public | `{ email, name, password, photoURL? }` → 201 empty. Email trimmed+lowercased (max 254), name trimmed 1–100, password 8–72; `400` validation; `422 "Email already in use"`                                                                                                                 |
| GET    | `/api/v1/user/me`                                        | JWT    | current user                                                                                                                                                                                                                                                                              |
| DELETE | `/api/v1/user/me`                                        | JWT    | permanently deletes the token user's account and data. Body `{ email }` (confirmation, trimmed + lowercased, must equal the stored email: else 422 `Email does not match`); `204`; 400 invalid body; 500 a step failed (retry is safe). Never accepts an id                               |
| GET    | `/api/v1/user/:id`                                       | JWT    | ⚠ no ownership check                                                                                                                                                                                                                                                                      |
| PATCH  | `/api/v1/user/:id`                                       | JWT    | ⚠ no ownership check; partial update                                                                                                                                                                                                                                                      |
| GET    | `/api/v1/families`                                       | JWT    | families the user belongs to (joined memberships), sorted by name (case-insensitive) then `createdAt`; `[]` if none                                                                                                                                                                       |
| POST   | `/api/v1/families`                                       | JWT    | `{ name }` (trimmed, 1–50) → `201 FamilyOutput`; creates family + owner membership atomically; `400` invalid name                                                                                                                                                                         |
| GET    | `/api/v1/families/:familyId`                             | JWT    | `200 FamilyOutput`; `400` bad UUID; `404` unknown or non-member                                                                                                                                                                                                                           |
| PATCH  | `/api/v1/families/:familyId`                             | JWT    | `{ name }` → `200 FamilyOutput`; owner only: `403` member non-owner, `404` non-member                                                                                                                                                                                                     |
| DELETE | `/api/v1/families/:familyId`                             | JWT    | `204`; owner only; order `404 → 403 → 409`; `409 "Family still owns records"` when a registered owned-records check (finance, stock) is true                                                                                                                                              |
| GET    | `/api/v1/finance/accounts?ownerId=…&today=YYYY-MM-DD`    | JWT    | accounts of the accessible owners with `initialBalance`, `balance` (current, ≤ today), `projectedBalance` (≤ end of today's month); `today` missing → server UTC date, invalid → `400`; ACTIVE first then name; repeated `ownerId` narrows it                                             |
| POST   | `/api/v1/finance/accounts`                               | JWT    | body `{ name, icon, initialBalance?, owner, ownerId, status? }` (strict: `balance` → `400`) → `201 Account`                                                                                                                                                                               |
| PATCH  | `/api/v1/finance/accounts/:id`                           | JWT    | body any of `name`, `icon`, `status` (strict: `balance`/`initialBalance` → `400`) → `200 Account`                                                                                                                                                                                         |
| POST   | `/api/v1/finance/accounts/:id/balance-adjustment?today=` | JWT    | body `{ balance }` = desired current balance; records an INCOME/EXPENSE transaction of the difference on the system category `BALANCE_ADJUSTMENT`, dated `today`; no difference → no row; `200 Account`; `404`, `422 Account is archived`, `400` difference outside int4                  |
| DELETE | `/api/v1/finance/accounts/:id`                           | JWT    | `204`; `404`; `409 "Account has transactions"` (nothing deleted)                                                                                                                                                                                                                          |
| GET    | `/api/v1/finance/credit-cards`                           | JWT    | `200 CreditCard[]` of accessible owners, ACTIVE first then title; optional repeated `?ownerId=<uuid>` and `?status=ACTIVE\|ARCHIVED` (spec 026)                                                                                                                                           |
| GET    | `/api/v1/finance/credit-cards/overview`                  | JWT    | `200 { aggregate { totalLimit, used, available }, cards[{ card, used, available, openInvoice, closedInvoices[≤3] }] }`: ACTIVE cards only; invoices computed by `InvoiceCalculator`, "today" = America/Sao_Paulo, amounts 0 until purchases exist; `?ownerId=` narrows                    |
| GET    | `/api/v1/finance/credit-cards/:id`                       | JWT    | `200 CreditCard`; `404` not found or not accessible                                                                                                                                                                                                                                       |
| POST   | `/api/v1/finance/credit-cards`                           | JWT    | `{ title 1–60, limit int cents ≥1, brand VISA\|MASTERCARD\|ELO\|AMEX\|OTHER, closingDay 1–31, dueDay 1–31, paymentDay? 1–31, color #RRGGBB, lastDigits? 4 digits, status?, owner, ownerId }` → `201`; `403` owner not accessible; `400` validation                                        |
| PATCH  | `/api/v1/finance/credit-cards/:id`                       | JWT    | any subset (`paymentDay`/`lastDigits` accept `null` to clear; `owner`+`ownerId` together, new owner must be accessible → else `403`) → `200`; `400` empty/unknown key; `404`                                                                                                              |
| DELETE | `/api/v1/finance/credit-cards/:id`                       | JWT    | `204`; `404`; the `409 "Credit card has transactions"` guard arrives with the spec that links transactions                                                                                                                                                                                |
| GET    | `/api/v1/finance/categories`                             | JWT    | `200 Category[]` (`parentId` null for roots, read-only `depthLevel`), sorted by `type` then name (case-insensitive); filters `?type=EXPENSE\|INCOME`, repeated `?ownerId`                                                                                                                 |
| POST   | `/api/v1/finance/categories`                             | JWT    | `{ name, icon, iconColor? '#RRGGBB' (default '#000000'), type, parentId?, owner, ownerId }` → `201`; `403` owner; `404` parent not found/accessible; `400` parent with another owner/ownerId/type                                                                                         |
| PATCH  | `/api/v1/finance/categories/:id`                         | JWT    | any of `name`, `icon`, `iconColor`, `type`, `parentId` (`null` = make root; moving recomputes the subtree depth) → `200`; `400` owner fields / cycle / parent mismatch; `404`; `409` type change not allowed                                                                              |
| DELETE | `/api/v1/finance/categories/:id`                         | JWT    | `204`, deletes the whole subtree of subcategories (FK cascade); `404`; `409 "Category has transactions"` when the category or a subcategory has transactions (nothing deleted)                                                                                                            |
| GET    | `/api/v1/finance/transactions`                           | JWT    | `200 Transaction[]` sorted `date` desc then `createdAt` desc; read-only embedded `account { id, name, icon }` and `category { id, name, icon, iconColor }`; repeated `?ownerId`                                                                                                           |
| POST   | `/api/v1/finance/transactions`                           | JWT    | `{ description 1–200, value int cents > 0 (max 2147483647), date YYYY-MM-DD, type, accountId, categoryId, owner, ownerId }` → `201`; `403` owner; `404` account/category not found or not accessible; `400` account/category with another owner, category type ≠ type, invalid value/date |
| PATCH  | `/api/v1/finance/transactions/:id`                       | JWT    | any POST field (rules checked on the resulting record; owner may change only with a matching account/category) → `200`; `403`/`404`/`400` as POST                                                                                                                                         |
| DELETE | `/api/v1/finance/transactions/:id`                       | JWT    | `204`; `404`                                                                                                                                                                                                                                                                              |

Transactions: POST/PATCH answer `422 Account is archived` (create, or a PATCH that moves into an archived account), `422 System category is reserved` (a system `categoryId`), `422 Balance adjustments cannot be edited`; responses carry `category.systemKey` (`BALANCE_ADJUSTMENT` | null) and `category.excludeFromTotals`. System categories are not returned by `GET /finance/categories` and PATCH/DELETE on them answer `422 System categories cannot be changed`.
| GET | `/api/v1/stock/items` | JWT | list items of the caller + their families; optional `?ownerId=<uuid>` (inaccessible → `200 []`, repeated/non-uuid → `400`); sorted by `expirationDate` asc nulls last, `description`, `id` |
| GET | `/api/v1/stock/items/:id` | JWT | `200 StockItem`; `404` missing or not accessible |
| POST | `/api/v1/stock/items` | JWT | `{ owner, ownerId, description 1–200, quantity int 0..1,000,000, unit unit\|gram\|kilogram\|liter\|milliliter, brand?, barcode?, notes?, purchaseDate?, openingDate?, expirationDate? }` → `201`; strict body; `403` owner not accessible |
| PATCH | `/api/v1/stock/items/:id` | JWT | partial; `null` clears optionals; `owner`+`ownerId` together (a move needs access to both); `400` empty body / one of the pair / null on a required field; `403` new owner; `404` |
| DELETE | `/api/v1/stock/items/:id` | JWT | `204`; `404` missing or not accessible |
| GET | `/api/v1/families/:familyId/members` | JWT | `200 FamilyMember[]` (owner first, joined by `joinedAt`, pending by `createdAt`; derived `role`/`status`/`inviteExpired`; `user: { name, photoUrl } \| null`); `400` bad UUID; `404` unknown family or non-member (pending invitees too) |
| POST | `/api/v1/families/:familyId/members` | JWT | `{ email }` (trimmed, lower-cased, ≤254) → `201 { member, inviteToken, inviteExpiresAt }` (raw token returned **once**, only its SHA-256 is stored; expires in 7 days); `400`; `403` member non-owner; `404`; `409 FAMILY_MEMBER_ALREADY_EXISTS` |
| DELETE | `/api/v1/family-members/:memberId` | JWT | `204`; owner removes/cancels any row but their own (`409 FAMILY_OWNER_CANNOT_BE_REMOVED`); a member may delete only their own row (leave); other rows `403`; strangers/unknown ids `404` |
| GET | `/api/v1/family-invites/:token` | JWT | `200 { familyId, familyName, email, inviteExpiresAt, emailMatches }`; does not consume the token; `400` malformed token; `404 INVITE_NOT_FOUND`; `410 INVITE_EXPIRED` |
| POST | `/api/v1/family-invites/:token/accept` | JWT | empty body → `200 FamilyMember` (`JOINED`); `400`; `403 INVITE_EMAIL_MISMATCH`; `404 INVITE_NOT_FOUND`; `409 FAMILY_MEMBER_ALREADY_EXISTS`; `410 INVITE_EXPIRED`; single-use, concurrency-safe |

**Invite security:** token = 32 CSPRNG bytes base64url (43 chars) from `@shared/infra/token`; only its SHA-256 is stored. The error-body `path` is redacted for `/family-invites/*`; the API has no request logger and tokens must never be logged.

**Family delete composition:** `FamilyService.delete` runs `EnsureFamilyOwnerUseCase` (404/403), then every check in the `FAMILY_OWNED_RECORDS_CHECKS` list (token + `IOwnedRecordsCheck { execute({ owner, ownerId }) → boolean }` in `src/api/family/v1/family-records-checks.ts`), then `DeleteFamilyUseCase`. The list is empty until specs 005/006 register their module-level use case in `FamilyAPIModule`.

**Account deletion composition (spec 024):** `AccountDeletionService.deleteAccount` (`api/user/v1`) runs `ConfirmUserEmailUseCase` (404/422), `GetOwnedFamilyIdsUseCase`, then for `[USER:me, FAMILY:<each owned family>]` every entry of the `OWNED_RECORDS_PURGES` list (token + `OwnedRecordsPurgeEntry { module, purge: { execute({ owner, ownerId }) → number } }` in `api/user/v1/owned-records-purges.ts`, registered in `UserAPIModule`: finance and stock), then `RemoveUserFromFamiliesUseCase` and finally `DeleteUserUseCase`. No cross-module transaction: every step is idempotent and the user row goes last, so a failure (500) leaves the account and a retry finishes. A future owned module appends its purge in `UserAPIModule` only. It logs the user id and counts only.

Errors come out of `AllExceptionsFilter` as `{ message, path, statusCode, timestamp }` (5xx hidden behind "Internal Server Error", validation failures are 400 "Validation Failed").
**CORS:** enabled in `main.ts` only when `CORS_ORIGINS` (comma-separated origins) is non-empty; methods `GET, POST, PATCH, PUT, DELETE, OPTIONS`, headers `Authorization, Content-Type`, no credentials (the token travels in `Authorization`). Empty = disabled.

Keep this table updated when endpoints change, and mirror changes in `integration.md`.

### Card purchases and invoices (spec 029)

`POST/PATCH /finance/transactions` take `accountId` XOR `creditCardId` (optional `?today=`); responses add `creditCard`, `creditCardId`, `invoiceMonth` and, for card purchases, `overLimit`. `GET /finance/transactions` default = account rows only; `?source=CARD&creditCardId&invoiceMonth` lists purchases. `InvoiceController` (registered before `CreditCardController`): `GET /finance/credit-cards/invoices?month=YYYY-MM&ownerId&today` (invoices whose list day is in the month, with purchases), `GET /:id/invoices/:month`, `POST /:id/invoices/:month/payment` (`{method: ACCOUNT|EXTERNAL, accountId?, paidOn?}`), `DELETE /:id/invoices/:month/payment`. The overview adds `upcomingInvoices`, `listDate` and `payment` per invoice and accepts `?today`.

### Installment plans (spec 030)

`/finance/installment-plans` (controller `installment-plan.controller.ts`, service `installment-plan.service.ts`, dto `installment-plan.dto.ts`):

- `POST` `{ creditCardId, value (TOTAL cents), installments 2–48 (total >= count), date, description, categoryId, owner, ownerId, today? }` → 201 `{ plan, installments: [{ id, installmentNumber, value, invoiceMonth, invoiceStatus }], overLimit }`. Row 1 takes `value - base*(n-1)` (remainder on the first); installment k lands on `invoiceMonthOf(date, closingDay) + (k-1)`. 422 `Credit card is archived` / `Invoice is paid`; 400 for n outside 2–48 or total < n.
- `GET /:id` (optional `?today=`) → same shape without `overLimit`; `plan.totalValue` = SUM of the current installment values.
- `PATCH /:id` ("All"): any of `description, categoryId, value (new total), installments, creditCardId, date`. Only a REAL change of total/count/card/date recreates the rows (422 `An installment is in a paid invoice` when any is paid); otherwise it is text-only and also renames paid installments.
- `DELETE /:id` → 204; 422 `An installment is in a paid invoice`.
- `PATCH /finance/transactions/:id` on an installment REQUIRES `scope` (`ONLY_THIS` | `THIS_AND_NEXT`) and accepts only `value`, `description`, `categoryId` (`date/type/owner/ownerId` → 400; `accountId/creditCardId` → 422 `Edit the installment plan instead`; `scope` on a plain transaction → 400). `DELETE /finance/transactions/:id` on an installment → 422 `Delete the installment plan`.
- Transaction and invoice-purchase payloads gain `installmentPlanId`, `installmentNumber`, `installmentCount` (nullable).
- 029 FR 7 relaxed: in a paid invoice a card purchase may change only description and category (value/date/card/invoice stay locked, 422 `Invoice is paid`).

### Card credits: prepayment, refunds, early payments (spec 032)

- Invoice payloads (`/credit-cards/overview`, `/credit-cards/invoices`, `/:id/invoices/:month`) gain `net, carryIn, total, amountDue, earlyPaid`; `amount` keeps meaning "what to pay" (= `amountDue`, frozen on the payment once paid). The detail also returns `credits: [{ id, kind: REFUND | PREPAYMENT_DISCOUNT | EARLY_PAYMENT, description, value, date, refundedName, refundedTransactionId, refundedPlanId, method, accountId, accountName }]`; purchases gain `prepaid`.
- `GET /installment-plans/:id/prepayment-preview?targetInvoiceMonth=&today=` → `{ eligible: [{ id, installmentNumber, value, invoiceMonth }], total }`. `POST /installment-plans/:id/prepayment` `{ targetInvoiceMonth, date, discount?, today? }` → 201 plan (with `prepayment: { id, targetInvoiceMonth, date, discount } | null`, installments with `prepaid`); 400 discount > total, 409 already prepaid, 422 target paid/upcoming, card archived, nothing eligible. `DELETE …/prepayment` → 204; 422 `Invoice is paid`. `PATCH /installment-plans/:id` structural change after a prepayment → 422 `Undo the prepayment first`.
- `POST /credit-cards/:id/refunds` `{ date, description, value, invoiceMonth, refundedTransactionId?, refundedPlanId?, today? }` → 201 `{ id, creditCardId, date, description, value, invoiceMonth, refundedTransactionId, refundedPlanId }`; `PATCH|DELETE …/refunds/:refundId` (paid invoice: description only / delete 422). 422: invoice paid/upcoming, card archived, link on another card, `Refunds can't exceed the purchase value`. Purchases/plans with refunds: delete → 422 `Delete its refunds first`.
- `POST /credit-cards/:id/early-payments` `{ date, description, value, invoiceMonth, method: ACCOUNT | EXTERNAL, accountId?, today? }` → 201 `{ id, date, description, value, invoiceMonth, method, accountId?, accountTransactionId? }`; `PATCH|DELETE …/early-payments/:earlyPaymentId`. 400 date after `today` / accountId mismatch, 404 card or account, 422 invoice paid/upcoming, `The value can't exceed what is left to pay`, card or account archived, 409 invoice changed. The account debit row (`INVOICE_PAYMENT`, `excludeFromTotals`) is edited only through the early payment (`PATCH|DELETE /transactions` → 422).
- Transaction payloads gain `earlyPayment: { id, creditCardId, invoiceMonth } | null` on the account debit row of an early payment (the app hands that row over to the early payment sheet).
- `/transactions` still refuses `INCOME` on a card (400) and the three new system categories (422).

### Paid status (spec 033)

`POST/PATCH /api/v1/finance/transactions[/:id]?today=YYYY-MM-DD` accept an optional `paid: boolean` (account rows only; sending it for a card row or an installment → 422 `Card purchases follow their invoice`). Create without `paid` → `date <= today`. PATCH `{ paid: true }` on an unpaid row without `date` also sets `date = today`; `{ paid: false }` and date-only edits never change the other field. Every transaction response carries `paid` (card rows: derived from their invoice by `ResolveCardRowsPaidUseCase`). `GET /transactions` accepts `?today=` for that derivation. Account `balance` = `ledger_balance` (paid rows only) and `projectedBalance` = `balance` + unpaid rows dated up to the end of today's month (one grouped query, `findUnpaidSums`).

### Recurring transactions (spec 034)

`/api/v1/finance/recurrences` (`RecurrenceController` + `RecurrenceService`; `GET /recurrences/projections` is its own `RecurrenceProjectionController`, registered **before** the other because the lint rules keep methods alphabetical and `:id` would capture `projections`). `POST /` creates a series (`frequency` WEEKLY|BIWEEKLY|MONTHLY|YEARLY, optional `endDate`, `paid` for occurrence 1) with its real rows up to the end of `today`'s month; `GET /` lists (`accountId`, `creditCardId`, `status`, `ownerId`); `GET /:id` returns the series, its rows and the next 12 projected occurrences; `PATCH /:id` is scope ALL (`description`, `categoryId`, `value`, `endDate` nullable); `POST /:id/split` is THIS_AND_NEXT (`occurrenceNumber`, `value`, `description`, `categoryId`, `accountId` | `creditCardId`, `frequency`, `endDate`); `POST /:id/occurrences/:number` makes a projected occurrence real with edits; `DELETE /:id/occurrences/:number?scope=ONLY_THIS|THIS_AND_NEXT&confirmPaid=` and `DELETE /:id?confirmPaid=` (200 `{ deleted, detached }`; 409 `{ message: 'Paid occurrences', paidCount, paidTotal, detachedCount }` without `confirmPaid`). `PATCH /transactions/:id` on a recurring row: `paid` (± `date`) needs no scope, anything else `scope: ONLY_THIS` (422 `Choose the edit scope` / `Use the recurrence split` / `Owner cannot change on a recurring transaction`); `DELETE /transactions/:id?scope=ONLY_THIS` (422 `Choose the delete scope`). Every read that depends on real rows (`GET /transactions`, `/accounts`, `/credit-cards/overview`, `/credit-cards/invoices`, `/credit-cards/:id/invoices/:month`, `/recurrences/projections`) calls `MaterializeRecurrencesUseCase` first. Projected items carry `invoiceMonth` and `invoiceListDate` (planned payment day of that invoice) for card series, so the app can place them in the month the invoice appears. Transaction payloads gain `recurrenceId`, `occurrenceNumber`, `occurrenceCount`, `recurrenceFrequency` (nullable).

### Daily balances and the card payment account (spec 035)

`GET /api/v1/finance/accounts/daily-balances?month=YYYY-MM&ownerId=&today=` (declared before the `:id` routes): one item per calendar day with `total`, `cardsDue`, `projected` and the balance of each active account at the **end of that day** (paid rows on their date; from `today` on also unpaid rows, projected occurrences and card invoices still to pay). `400` invalid month or more than 12 months after today's month (`Month is too far ahead`); `403` when any `ownerId` is not accessible (unlike the other reads, which drop it silently). Materializes recurrences first. Cards accept/return `paymentAccountId` (`POST`/`PATCH /credit-cards`: `404 Account not found`, `422 Account is archived`, `null` removes) and `paymentAccount { id, name, icon, status } | null` (null for a reader without access to the account).

### Currency per resource (spec 040)

- Accounts, credit cards, transactions, recurrences (incl. `/recurrences/projections`), installment plans and invoices return `"currency": "BRL"`. The supported list is `SUPPORTED_CURRENCIES = ['BRL','USD','EUR']` (`@finance/domain/enum/Currency`, validated by `CurrencySchema`, no Prisma enum); default `DEFAULT_CURRENCY = 'BRL'`.
- Create bodies (`POST /accounts`, `/credit-cards`, `/transactions`, `/recurrences`, `/installment-plans`) accept an optional `currency`; a code outside the list → 400. It is **not accepted on PATCH** of accounts and cards (400, `.strict()`).
- A transaction, recurrence or plan takes the currency of its account/card when none is sent. A different one → 422 `Transaction currency must match the account currency` / `... the credit card currency` (`EnsureTransactionConsistencyUseCase`, also on update/split/plan recreate, where the stored currency is checked against the new account/card).
- Money moves between an account and a card (invoice payment, early payment, card `paymentAccountId`) need one currency, else 422 `Account currency must match the credit card currency`.
- System rows (balance adjustment, invoice payment, prepayment discount, refund, early payment and its account debit) take the currency of their account/card.
