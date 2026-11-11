# Monitoring (Sentry) — spec 106

Goal: an unexpected API error reaches Sentry with the original `.ts` file and line, release, environment, route, user id and a trace shared with the web, and **no personal or financial data**. The web side is in `../life-planner/.claude/context/monitoring.md`.

## Projects, releases, environments

- One Sentry project per repo (`life-planner-back` here), same organization; sentry.io.
- Release: `life-planner-back@<package.json version>` (same value as `GET /api/v1/version`). It maps to the git tag `vX.Y.Z` of the release workflow; no `set-commits`.
- Environment: `SENTRY_ENVIRONMENT` (default `NODE_ENV`); staging sends with `staging`.
- Source maps: `tsconfig` builds them; the `Dockerfile` builder injects debug ids and uploads `dist/` with `@sentry/cli` when the build args `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are set; otherwise one `WARNING` line and the build succeeds. The token exists only in the builder stage (never the runtime image). The `.map` files stay in `dist/` (not served over HTTP).

## Code

- `src/instrument.ts` (imported first by `main.ts`) calls `initMonitoring`; only `src/shared/infra/monitoring` imports `@sentry/nestjs`.
- Env: `SENTRY_DSN` (absent = disabled), `SENTRY_ENABLED` (default `false`), `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` (0–1, default 0; production `0.1` recommended; errors are always captured whatever the rate).
- `AllExceptionsFilter` calls `captureException` only when the status is ≥ 500 or the exception is not an `HttpException`. 4xx and `NotModifiedException` are never sent. The explicit capture is used instead of the SDK's global filter so 4xx can never leak.
- `Scheduler.cron` captures failing jobs with the tag `job`. `main.ts` captures a bootstrap failure and flushes before exit.
- Safety nets: the filter's capture is wrapped (a failure building the tags still sends the exception, a failing SDK never breaks the reply; `getClass()` is `null` outside a controller). `registerFatalHandlers` (called in `main.ts`) captures `uncaughtException`/`unhandledRejection` with the tag `phase`, flushes, logs and exits, so an error that escapes every filter is still reported.
- `src/instrument.ts` calls `process.loadEnvFile()` first: in dev the `.env` is otherwise read only by Nest's `ConfigModule`, after the SDK started (it never overrides variables already set; production has no `.env`).
- CORS allows the request headers `sentry-trace` and `baggage` (the web sends them to the API). Deploy order: API first, then the web.

## Tags

`route` (Nest route template, e.g. `/api/v1/finance/transactions/:id`), `method`, `status_code`, `module` (controller), `job`, `owner_type` (`USER|FAMILY|ALL`), `family_id`, plus `user.id`. Same names as the web.

## Following a trace from the web

Open the web issue → its trace id → search the same id in the `life-planner-back` project; the API event shares it when the web request ended in a 5xx.

## Privacy rules (never add to an event)

`sendDefaultPii: false`; user = `id` only; no request body, cookies, `Authorization`; `q` redacted in URLs/breadcrumbs; keys `password, token, refreshToken, accessToken, authorization, email, name, description, notes, amount, body` dropped by `scrubEvent` (`shared/infra/monitoring/scrub.ts`). Ids (user, family, account, transaction, card) are allowed.

## Testing the setup

Set `SENTRY_DSN` and `SENTRY_ENABLED=true`, throw in a route locally, check the issue shows the `.ts` line and the tags above.
