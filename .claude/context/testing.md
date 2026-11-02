# Testing (Jest 29 + ts-jest + @nestjs/testing + @faker-js/faker)

Global coverage threshold **90%** (branches/functions/lines/statements); `pre-push` runs `yarn test --coverage`. Excluded from coverage: `*.d.ts`, `*.fixture(s).ts`, `*.mock(s).ts`, `*.module.ts`, `src/main.ts`. Test regex: `*.test.ts` (files under `/tests/` are ignored; `tests/setup.ts` seeds faker with `42`).

## Layout (next to the source file)

```
index.ts            index.test.ts            index.mocks.ts        # directory pattern
UserEntity.ts       UserEntity.test.ts       UserEntity.mocks.ts   # single-file pattern
entity/mocks/<Name>Entity.fixture.ts                               # builder fixture
```

## Mocks file pattern (`index.mocks.ts`)

Sections marked `// region Mocks / Spies … // endregion`. Build a Nest testing module in `beforeEach`, mock dependencies by token, export `{ mocks, setup, spies }`.

```ts
const userRepositoryMock = {
  getUserById: jest.fn().mockResolvedValue(existingUserMock),
  updateUser: jest.fn(),
};
let setup: UpdateUserUseCase;
beforeEach(async () => {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    providers: [UpdateUserUseCase, { provide: 'IUserRepository', useValue: userRepositoryMock }],
  }).compile();
  setup = module.get(UpdateUserUseCase);
});
export { mocks, setup, spies };
```

Tests import `{ mocks, setup, spies } from './index.mocks'` and contain only assertions.

## Fixtures

Builder class with `value`, `build()` (returns a copy and resets), `withDefault()` using `faker`, and `withX()` chainable setters; optional fields via explicit `withOptional()` methods. Copy `UserEntity.fixture.ts`.

## Conventions

- Titles: `it('SHOULD <behavior> [WHEN <condition>]', …)`.
- AAA structure; cover success **and** error paths (`rejects.toThrow(NotFoundException)`), partial/optional inputs and "called with" assertions.
- Mock `jest.mock('<entity path>')` only when the test needs to spy on construction (as in `UpdateUserUseCase`).
- Datasource tests mock `Database` (`client.<model>.<method>` spies); repository tests mock the datasource + mapper; controller tests mock the service; service tests mock use cases.
- Fake data only (faker, `test@example.com`, `user-id-123`).
- Commands: `yarn test`, `yarn test:watch`, `yarn test:cov`. Note: the `test:e2e` script points to `./test/jest-e2e.json` but the folder is `tests/` — fix the path before relying on e2e.

## Perf dataset (`yarn perf:seed`, spec 064)

Fills a dedicated perf account with a fixed volume (stock, family, finance; `perf/seed.config.json`) through the HTTP API of a local instance, so perf budgets always measure the same data. Code: `scripts/perf/seed.ts` and `scripts/perf/seed/*` (unit tests next to them, HTTP client mocked).

- Env (from `.env`, placeholders in `.env.example`): `PERF_USER_EMAIL`, `PERF_USER_PASSWORD`, `PERF_SEED_ALLOW=staging`, optional `PERF_API_URL` (default `http://localhost:<PORT>`). Never printed, logged or written to the manifest.
- Run: `zsh -ic 'yarn perf:seed [--module stock|family|finance] [--reset]'`. Without `--module` it seeds everything.
- Safety gate (exit code 2, one line): `PERF_SEED_ALLOW=staging` required, `NODE_ENV` not `production`, API host `localhost` or `127.0.0.1`. `--reset` deletes only the perf account (`DELETE /api/v1/user/me`) and refuses if the logged-in email is not `PERF_USER_EMAIL`.
- Deterministic and idempotent: fixed faker seed (`seed` in the config), names prefixed `Perf`; a second run creates 0 records. A non-2xx response aborts with `METHOD path -> status` (no body).
- Output: `perf/seed.manifest.json` (gitignored): perf user id, family ids, reference month (the month before today, at least 300 rows), counts, config hash, timestamp.

## Perf budgets (`yarn perf`, spec 065)

Counts the SQL statements of one HTTP call per route and blocks a PR that adds queries. Query counts are deterministic, timings are not (those arrive in spec 066).

- **Registry:** `perf/budgets/<module>.json` for `finance`, `stock`, `family` (families, members, invites), `user` (user + auth), `version`, `health`. Key `"<METHOD> <path template>[ #<scenario>]"`; fields `kind` (`read` | `write` | `unmeasured`), `maxQueries` (blocking), `scenario` (query string; tokens `{monthStart}`, `{monthEnd}`, `{referenceMonth}`, `{nextMonth}`, `{userId}`, `{familyId}`), `params` (`:name` -> fixture: `account`, `card`, `category`, `family`, `plan`, `recurrence`, `stockItem`, `tag`, `userId`, `referenceMonth`), `recipe` (writes: a create-measure-delete cycle in `scripts/perf/measure/recipes.ts`), `reason` (required for `unmeasured`) and the placeholders `p50Ms`, `maxBytes`, `indexes` (all `null` until 066).
- **Coverage test (in `yarn test`, no database):** `scripts/perf/registry.coverage.test.ts` reads the Nest controller metadata (`scripts/perf/routes.ts`) and fails when a route has no entry, or an entry has no route. New route: add its key to the module file, then `yarn perf --module <m> --update-baseline`.
- **Counter:** `PERF_COUNT_QUERIES=1` makes `Database` enable `QueryCounter` (`@shared/infra/db`), which patches `pg.Client.prototype.query`; unset, nothing is patched. `BEGIN/COMMIT/ROLLBACK` count in the total and are listed separately.
- **Runner:** jest project `perf/jest.perf.config.ts` (`perf/**/*.perf.test.ts`, ignored by `yarn test`) boots `AppModule` in-process on a random port against the database of `.env`, logs in as the perf user (spec 064 manifest) and calls each entry once (a GET is called twice, the first as a warm-up). Run it through the CLI only.
- **CLI:** `zsh -ic 'yarn perf --changed | --all | --module <m> [--dry-run] [--update-baseline]'`. `--changed` maps `git diff origin/main...HEAD` + working tree to modules (`src/modules/<m>`, `src/api/<m>`; `family-member` -> `family`, `auth` -> `user`; `src/shared`, `prisma`, `package.json`, `yarn.lock` select all). It runs `yarn perf:seed --module <m>` first when the manifest is missing or its config hash is stale, and writes `perf-report/summary.md` (gitignored) ending in `PERF PASSED: N/N`.
- **Safety gate (exit 2):** `PERF_SEED_ALLOW=staging`, `NODE_ENV`/`APP_ENVIRONMENT` not `production`, `DB_HOST` `localhost` or `127.0.0.1`. Never against production.
- **`perf:check` (spec 066):** `zsh -ic 'yarn perf:check [--module <m>] [--update-baseline]'` (also run per module by `yarn perf`). Builds, starts `node dist/src/main` on `PERF_PORT` (default 3999; never touches another process), then per `read` entry: 2 warm-ups + 7 runs, p50 and uncompressed bytes against `p50Ms`/`maxBytes`. Fails when `p50 > 1.25 x p50Ms` and `p50 - p50Ms > 15 ms`, or bytes exceed `maxBytes`. Lists over 256 KB fail unless the entry has `knownException` (specs 078 unbounded lists, stock list deferred, CSV export by design). `perf/concurrency.json` holds the 4-calls-x3 scenario (`wallMs`, same rule; `maxPoolWaiting` skipped while `null`, spec 069). Entries with `table` + `indexes` get a plain `EXPLAIN (FORMAT JSON)` of their SQL (bind values from the counter): a `Seq Scan` of the table fails unless `seqScanException`, and a listed index must be used. Exit 0 ok, 1 regression, 2 could not run. Output is appended to `perf-report/summary.md`.
- **Ratchet:** a budget may only go up with a written reason in the PR description. A spec that improves an endpoint lowers its budget in the same PR (`--update-baseline`, review the diff). A seed config change needs `--update-baseline` in the same PR.
- **Unmeasured routes:** auth writes, account deletion, invites/members, CSV import, invoice payment, prepayment, card refunds/early payments, balance adjustment and recurrence occurrence edits have no safe create-then-delete cycle yet; they are registered as `unmeasured` with a reason so the coverage test still sees them.
