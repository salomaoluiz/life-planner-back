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
