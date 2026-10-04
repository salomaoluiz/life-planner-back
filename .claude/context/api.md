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

| Method | Path                        | Auth   | Notes                                                                                                                                                                        |
| ------ | --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`               | public | terminus                                                                                                                                                                     |
| POST   | `/api/v1/auth/login/email`  | public | `{ email, password }` → `201 { token }` (Nest default POST status); email trimmed+lowercased; password 1–72; `401 "Invalid Credentials"` for unknown email or wrong password |
| POST   | `/api/v1/auth/signup/email` | public | `{ email, name, password, photoURL? }` → 201 empty. Email trimmed+lowercased (max 254), name trimmed 1–100, password 8–72; `400` validation; `422 "Email already in use"`    |
| GET    | `/api/v1/user/me`           | JWT    | current user                                                                                                                                                                 |
| GET    | `/api/v1/user/:id`          | JWT    | ⚠ no ownership check                                                                                                                                                         |
| PATCH  | `/api/v1/user/:id`          | JWT    | ⚠ no ownership check; partial update                                                                                                                                         |

Errors come out of `AllExceptionsFilter` as `{ message, path, statusCode, timestamp }` (5xx hidden behind "Internal Server Error", validation failures are 400 "Validation Failed").
**CORS:** enabled in `main.ts` only when `CORS_ORIGINS` (comma-separated origins) is non-empty; methods `GET, POST, PATCH, PUT, DELETE, OPTIONS`, headers `Authorization, Content-Type`, no credentials (the token travels in `Authorization`). Empty = disabled.

Keep this table updated when endpoints change, and mirror changes in `integration.md`.
