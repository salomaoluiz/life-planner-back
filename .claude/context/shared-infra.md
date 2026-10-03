# Shared infra (`src/shared/infra`)

The only place allowed to import third-party libs directly (ESLint `no-restricted-imports` blocks them elsewhere; exceptions: `zod`, `nestjs-zod`, `@nestjs/*`, `jest`, `@faker-js/*`). Pattern: interface in `types.ts`, implementation in a sub-folder, bound to a string token in `shared.module.ts`, tests + mocks alongside.

| Folder             | Provides                                                                      | Token / usage                                |
| ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------- |
| `env/`             | `EnvService`, `EnvModule`, `envSchema` (zod) validated at boot                | inject `EnvService`; add vars to `envSchema` |
| `db/`              | `Database` — Prisma client with `PrismaPg` adapter; use `db.client`           | inject `Database` (exported by SharedModule) |
| `jwt/`             | `IJwtProvider` (`sign`, `verify`), `JwtPayload = { user: { id } }`, Nest impl | `'IJwtProvider'`                             |
| `logger/`          | `ILogger.log(level, message, { module, ... })`, `LogLevel`, Pino impl         | `'ILogger'`                                  |
| `password-hasher/` | `IPasswordHasher` + bcrypt impl                                               | `'IPasswordHasher'`                          |
| `uuid/`            | uuid generation wrapper                                                       | import from `@shared/infra/uuid`             |
| `validation/`      | `validate(schema, data)` → returns data or throws `ValidationError`           | `@shared/infra/validation`                   |
| `http/`            | `JwtAuthGuard`, `@Public()`, `AllExceptionsFilter`                            | registered globally in `SharedModule`        |

## Environment variables (`env/env.schema.ts`)

`NODE_ENV`, `PORT`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `DB_USER`, `JWT_SECRET` (min 10 chars), `JWT_EXPIRES_IN` (seconds, default 3600). `prisma.config.ts` and `docker-compose.yml` read the same `DB_*` names.

Adding a variable: `envSchema` → `EnvService` getter (+ its test/fixtures) → `docker-compose.yml` `environment` → placeholder in `.env.example`. Values never go in source.

## Adding a wrapper

1. `shared/infra/<name>/types.ts` interface (+ `index.ts` impl, `index.test.ts`, `index.mocks.ts`).
2. Provide it in `SharedModule` (`{ provide: 'I<Name>', useClass }`) and add the token to `exports`.
3. Consumers `@Inject('I<Name>')`; never import the lib itself.

Logging: `logger.log(LogLevel.X, 'message', { module: 'ClassName', ...ctx })`. Never log passwords, hashes, tokens or full request bodies.
