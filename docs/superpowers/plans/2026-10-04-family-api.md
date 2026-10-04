# Family API (spec 003, backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `family` module end to end (Prisma models + migrations, domain, data, application, `/api/v1/families` API) so the app can create, list, read, rename and delete families with membership/ownership enforced in use cases.

**Architecture:** Follows the `user` module layout (`.claude/skills/new-feature-slice`). `family` module = use cases + `IFamilyRepository` → `IFamilyDatasource` (Prisma only in `data/`). `src/api/family/v1` is the single entrance: its service composes the `user` module (owner email for create) and an extensible list of "owner has records" checks (delete → 409). Create is one Prisma nested write, so family + owner membership are atomic.

**Tech Stack:** NestJS 10, TypeScript strict, Prisma 7 (`@prisma/adapter-pg`, generated client in `generated/prisma`), Zod 4 + `nestjs-zod`, Jest 29, ESLint/Prettier/Husky, Docker (throwaway Postgres for migrations/smoke test).

**Spec:** `/Users/salomao-neto/Downloads/003-family.md` (§4–§7, §9 Backend, §11, §12 Backend). Frontend counterpart is a separate plan: `../life-planner/docs/superpowers/plans/2026-10-04-family-api-datasource.md` (do not start it before this plan is merged).

## Global Constraints

- Route: `@Controller({ path: 'families', version: '1' })` in `src/api/family/v1/`; final URL `/api/v1/families`. JSON camelCase. Error body `{ message, path, statusCode, timestamp }` (already produced by `AllExceptionsFilter`).
- The current user always comes from the JWT (`req.user.id`). No endpoint accepts `userId`/`ownerId` from the client.
- `name`: required, trimmed, 1–50 characters after trimming (empty/whitespace-only → 400). Duplicate names allowed.
- Belongs to a family = a `family_members` row with `user_id = user` AND `joined_at` NOT NULL.
- Non-member → **404** (never reveal existence). Member but not owner on PATCH/DELETE → **403**. Delete check order: **404 → 403 → 409**. Invalid UUID → 400. Delete returns **204**; 409 message is exactly `Family still owns records`.
- List: sorted by `name` ascending (case-insensitive), then `createdAt` ascending; no pagination; none → `200 []`.
- Exported use cases for other modules (assumed contract of specs 005/006, names and signatures exact): `GetUserFamilyIdsUseCase.execute(userId: string) → string[]`, `CheckFamilyMembershipUseCase.execute({ userId, familyId }) → boolean`.
- Responses expose only `id, name, ownerId, createdAt, updatedAt`. Never `password_hash` or other user fields.
- Do not log family names or emails (ids only). Test data is fake (faker, `test@example.com`).
- Repository interface uses the `I` prefix (`IFamilyRepository`). `FamilyMemberRepository` stays untouched (spec 004 owns it).
- Path aliases only (`@api/*`, `@family/*`, `@shared/*`, `@user/*`, `@db/*`), never `../../`. No `any`, `@ts-ignore`, lint-disable. Object keys / class members sorted alphabetically (perfectionist lint).
- Infra libs only through `@shared/infra`; Prisma types (`@db/client`) only in `data/`.
- Conventional commits; never `--no-verify`; stage files explicitly (no `git add -A` / `.`); review `git diff --cached` for secrets before each commit. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- 90% global coverage threshold; every new class gets `index.test.ts` + `index.mocks.ts` (see `.claude/context/testing.md`).

## Decisions taken while planning (read before coding)

1. **Prisma field naming:** the repo convention (`User`) is snake_case Prisma fields with no `@map`; the spec table's camelCase "Prisma / API" column is mapped to that convention (`owner_id`, `created_at`, …). DB column names match the spec exactly. Tables are mapped with `@@map("families")` / `@@map("family_members")`.
2. **Id/FK types:** `User.id` is `String @id @default(uuid())` (Postgres `text`, table `"User"`, not `users`) and `User` cannot be edited except for relations. Postgres cannot FK `uuid → text`, so the new id/FK columns are also `text` holding UUID strings (no `@db.Uuid`). FKs reference `"User"."id"`.
3. **Migrations:** `prisma/migrations` does not exist, and `User` has never been migrated. Two migrations are committed: `20261004000000_baseline_user` (the existing `User` table) and a second one for the family tables. An environment whose DB already has `"User"` (created by `db push`) must run `yarn prisma migrate resolve --applied 20261004000000_baseline_user` once, otherwise `prestart`'s `migrate deploy` fails.
4. **Atomic create:** one `prisma.family.create({ data: { members: { create } } })` call (Prisma wraps nested writes in a single transaction) instead of manual `$transaction`.
5. **Owner email:** the `family` module cannot import `user`. `FamilyService.create` calls `FindUserByIdUseCase` (user module) and passes `ownerEmail` to `CreateFamilyUseCase`.
6. **Sorting** is a use-case rule done in memory (case-insensitive is not available via Prisma `orderBy`; counts are tiny).
7. **Owner check chain:** an extra `EnsureFamilyOwnerUseCase` (404 → 403) is used by `UpdateFamilyUseCase`, `DeleteFamilyUseCase` and by the API service before it runs the "owner has records" checks, so the required 404 → 403 → 409 order holds without business rules in `src/api`.
8. **"Owner has records" composition point:** injection token `FAMILY_OWNED_RECORDS_CHECKS` (array of `{ execute({ owner, ownerId }) → Promise<boolean> }`), shipped **empty** because stock/finance have no use cases yet. Specs 005/006 add their use case to it.
9. **No `toPersistence` in the mapper:** no write path takes a full entity (create/update take small param objects).

## Review Focus

- Pending invite (`joined_at` null, with or without `user_id`) must not be listed, readable, or count as membership → pinned in Task 3 (datasource filter assertions), Task 4 (membership use cases) and Task 8 (real DB).
- Client-supplied `ownerId`/`userId` in the POST/PATCH body must be ignored (ownerId always = JWT user) → pinned in Task 6 (controller + service tests).
- Name boundaries: 50 chars OK, 51 → 400, `"  x  "` trimmed, `"   "`/`""`/missing body/`null`/number → 400 → pinned in Task 5 (use case) and Task 6 (controller).
- Deploying to a DB that already has `"User"` without baselining → `prestart` fails → documented in Task 7 (`database.md`) and in the final report.
- Delete ordering and a deleted-but-still-authenticated user: non-owner member + records → 403 not 409; non-member → 404 before any check; valid JWT of a user row that no longer exists → 404 on create, not 500 → pinned in Task 6.

## File Structure

```
prisma/schema.prisma                                  # +Family, +FamilyMember, +relations on User
prisma/migrations/migration_lock.toml                 # new
prisma/migrations/20261004000000_baseline_user/       # new (User table)
prisma/migrations/20261004000100_family/                        # new (generated)
src/modules/family/
├── family.module.ts                                  # new, exports use cases
├── domain/entity/FamilyEntity/index.ts               # +createdAt, +updatedAt (tests/mocks/fixture updated)
├── domain/entity/mocks/FamilyEntity.fixture.ts
├── domain/repository/IFamilyRepository.ts            # renamed from familyRepository.ts, reshaped
├── domain/repository/index.ts
├── data/repository/datasource/IFamilyDatasource.ts
├── data/datasource/FamilyDatasource/index.ts         # (+test, mocks) Prisma only here
├── data/datasource/mapper/FamilyMapper/index.ts      # (+test, mocks)
├── data/repository/FamilyRepository/index.ts         # (+test, mocks)
└── application/
    ├── dto/FamilyUseCaseOutput.ts, CreateFamily.ts, UpdateFamily.ts, FamilyAccess.ts
    └── use-case/{CheckFamilyMembership,CreateFamily,DeleteFamily,EnsureFamilyOwner,GetFamilyById,GetUserFamilies,GetUserFamilyIds,UpdateFamily}UseCase/{index.ts,index.test.ts,index.mocks.ts}
src/api/family/
├── family.module.ts                                  # FamilyAPIModule
└── v1/
    ├── dto/family.dto.ts
    ├── family-records-checks.ts                      # token + interface
    ├── family.service.ts (+test, mocks)
    └── family.controller.ts (+test, mocks)
src/api/api.module.ts                                 # + FamilyAPIModule
```

---

### Task 1: Prisma models and migrations

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/migration_lock.toml`
- Create: `prisma/migrations/20261004000000_baseline_user/migration.sql`
- Create (generated offline): `prisma/migrations/20261004000100_family/migration.sql`

**Interfaces:**

- Produces: generated Prisma types `Family`, `FamilyMember` from `@db/client` with snake_case fields:
  `Family { id: string; name: string; owner_id: string; created_at: Date; updated_at: Date }`,
  `FamilyMember { id; family_id: string; email: string; user_id: string | null; joined_at: Date | null; invite_token: string | null; created_at: Date; updated_at: Date }`.
  Prisma delegates `client.family` and `client.familyMember`.

- [ ] **Step 1: Create the branch**

Run `git branch --show-current`. If `feat/002-email-auth-hardening` is already merged into `origin/main`, run `git fetch origin main && git checkout -b feat/003-family-api origin/main`; otherwise `git checkout -b feat/003-family-api` from the current branch. Confirm `git status --short` is clean first.

- [ ] **Step 2: Start a throwaway Postgres (kept running until Task 8)**

```bash
docker run --rm -d --name lp-pg-003 -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=lp -p 55432:5432 postgres:16
docker exec lp-pg-003 pg_isready -U postgres
```

Expected: `accepting connections` (retry after a few seconds if not). All `prisma` commands below are prefixed with
`DB_USER=postgres DB_PASSWORD=pg DB_HOST=localhost DB_PORT=55432 DB_NAME=lp` so the real `.env` DB is never touched (dotenv does not override variables already set).

- [ ] **Step 3: Generate the baseline migration from the CURRENT schema (only `User`), before editing it**

```bash
git show HEAD:prisma/schema.prisma > /tmp/lp-schema-before.prisma
mkdir -p prisma/migrations/20261004000000_baseline_user
printf '# Please do not edit this file manually\n# It should be committed to your version control system (e.g. Git)\nprovider = "postgresql"\n' > prisma/migrations/migration_lock.toml
yarn --silent prisma migrate diff --from-empty --to-schema /tmp/lp-schema-before.prisma --script 2>/dev/null > prisma/migrations/20261004000000_baseline_user/migration.sql
head -5 prisma/migrations/20261004000000_baseline_user/migration.sql
grep -c 'CREATE TABLE' prisma/migrations/20261004000000_baseline_user/migration.sql
```

Expected: the file starts with a `-- CreateSchema`/`-- CreateTable` SQL comment (not a "Loaded Prisma config" line — delete that line if it leaked in) and contains exactly one `CREATE TABLE "User"` plus `CREATE UNIQUE INDEX "User_email_key"`. (`yarn --silent` is needed: this repo uses Yarn 1, which prints a banner to stdout.)

- [ ] **Step 4: Add the models**

Edit `prisma/schema.prisma`. Add two relation lines to `User` (no other change to `User`), then append the new models:

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password_hash String
  photo_url String?
  created_at DateTime? @default(now())
  updated_at DateTime? @updatedAt
  families        Family[]
  family_members  FamilyMember[]
}

model Family {
  id         String   @id @default(uuid())
  name       String
  owner_id   String
  created_at DateTime @default(now()) @db.Timestamptz(6)
  updated_at DateTime @updatedAt @db.Timestamptz(6)

  owner   User           @relation(fields: [owner_id], references: [id], onDelete: Cascade)
  members FamilyMember[]

  @@index([owner_id])
  @@map("families")
}

model FamilyMember {
  id           String    @id @default(uuid())
  family_id    String
  email        String
  user_id      String?
  joined_at    DateTime? @db.Timestamptz(6)
  invite_token String?   @unique
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  updated_at   DateTime  @updatedAt @db.Timestamptz(6)

  family Family @relation(fields: [family_id], references: [id], onDelete: Cascade)
  user   User?  @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([family_id, email])
  @@index([user_id])
  @@map("family_members")
}
```

(`@@unique([family_id, email])` already indexes `family_id` as its leading column, so no extra `family_id` index.)

- [ ] **Step 5: Generate the family migration offline, validate, and apply both migrations to the throwaway DB**

```bash
mkdir -p prisma/migrations/20261004000100_family
yarn --silent prisma migrate diff --from-schema /tmp/lp-schema-before.prisma --to-schema prisma/schema.prisma --script 2>/dev/null > prisma/migrations/20261004000100_family/migration.sql
head -5 prisma/migrations/20261004000100_family/migration.sql
yarn prisma validate
yarn prisma generate
DB_USER=postgres DB_PASSWORD=pg DB_HOST=localhost DB_PORT=55432 DB_NAME=lp yarn prisma migrate deploy
DB_USER=postgres DB_PASSWORD=pg DB_HOST=localhost DB_PORT=55432 DB_NAME=lp yarn prisma migrate status
```

Expected: the new migration contains `CREATE TABLE "families"`, `CREATE TABLE "family_members"` and three `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` statements (and no `"User"` statements); `validate` says the schema is valid; `migrate deploy` applies 2 migrations; `migrate status` says "Database schema is up to date!". (Do not use `migrate dev`: it needs an interactive shell and a shadow database; the offline diff gives the same SQL deterministically.)

- [ ] **Step 6: Verify the generated SQL and the cascades on a real DB**

```bash
grep -n 'CREATE TABLE "families"\|CREATE TABLE "family_members"\|ON DELETE CASCADE\|family_members_family_id_email_key\|family_members_invite_token_key' prisma/migrations/20261004000100_family/migration.sql
docker exec lp-pg-003 psql -U postgres -d lp -v ON_ERROR_STOP=1 -c "
INSERT INTO \"User\"(id,email,name,password_hash) VALUES ('u1','a@example.com','A','x');
INSERT INTO families(id,name,owner_id,updated_at) VALUES ('f1','Fam','u1',now());
INSERT INTO family_members(id,family_id,email,user_id,joined_at,updated_at) VALUES ('m1','f1','a@example.com','u1',now(),now());
DELETE FROM \"User\" WHERE id='u1';
SELECT (SELECT count(*) FROM families) AS families, (SELECT count(*) FROM family_members) AS members;"
```

Expected: the grep lists both tables, FK cascades and both unique indexes; the final SELECT returns `families = 0 | members = 0` (user delete cascaded through owner and membership FKs).

- [ ] **Step 7: Type-check and commit**

```bash
yarn type-check
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add families and family_members models with baseline migrations" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: type-check passes (generated client is gitignored; it was regenerated in Step 5). Hooks pass.

---

### Task 2: Domain — entity timestamps and `IFamilyRepository`

**Files:**

- Modify: `src/modules/family/domain/entity/FamilyEntity/index.ts`, `index.mocks.ts`, `index.test.ts` (unchanged assertions, new mock fields)
- Modify: `src/modules/family/domain/entity/mocks/FamilyEntity.fixture.ts`
- Rename + modify: `src/modules/family/domain/repository/familyRepository.ts` → `IFamilyRepository.ts`
- Modify: `src/modules/family/domain/repository/index.ts`

**Interfaces:**

- Produces:

  ```ts
  class FamilyEntity {
    createdAt: Date;
    id: string;
    name: string;
    ownerId: string;
    updatedAt: Date;
  }
  type IFamilyRepository = {
    createFamily(params: CreateFamilyRepositoryParams): Promise<FamilyEntity>;
    deleteFamily(id: string): Promise<void>;
    getFamilies(userId: string): Promise<FamilyEntity[]>; // joined memberships only
    getFamilyById(familyId: string): Promise<undefined | FamilyEntity>;
    isFamilyMember(params: IsFamilyMemberRepositoryParams): Promise<boolean>;
    updateFamily(params: UpdateFamilyRepositoryParams): Promise<FamilyEntity>;
  };
  interface CreateFamilyRepositoryParams {
    name: string;
    ownerEmail: string;
    ownerId: string;
  }
  interface IsFamilyMemberRepositoryParams {
    familyId: string;
    userId: string;
  }
  interface UpdateFamilyRepositoryParams {
    id: string;
    name: string;
  }
  ```

  `FamilyEntityFixture` gains `withCreatedAt(date)` and `withUpdatedAt(date)`.

- [ ] **Step 1: Write the failing test (new mock fields)**

Replace `src/modules/family/domain/entity/FamilyEntity/index.mocks.ts` params:

```ts
const paramsMock: FamilyEntity = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  id: 'family-uuid-123',
  name: 'The Smiths',
  ownerId: 'owner-uuid-456',
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};
```

`index.test.ts` stays as is (it asserts `toEqual(mocks.params)`).

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest src/modules/family/domain/entity/FamilyEntity`
Expected: FAIL (ts-jest type error: `createdAt` does not exist in type `FamilyEntity`).

- [ ] **Step 3: Implement the entity**

`src/modules/family/domain/entity/FamilyEntity/index.ts`:

```ts
interface IFamilyEntity {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  updatedAt: Date;
}

class FamilyEntity {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  updatedAt: Date;

  constructor(params: IFamilyEntity) {
    this.createdAt = params.createdAt;
    this.id = params.id;
    this.name = params.name;
    this.ownerId = params.ownerId;
    this.updatedAt = params.updatedAt;
  }
}
export default FamilyEntity;
```

`src/modules/family/domain/entity/mocks/FamilyEntity.fixture.ts` — in `withDefault()` add `createdAt: faker.date.past()` and `updatedAt: faker.date.recent()` (keep keys alphabetical) and add:

```ts
  withCreatedAt(createdAt: Date) {
    this.value.createdAt = createdAt;
    return this;
  }
```

and

```ts
  withUpdatedAt(updatedAt: Date) {
    this.value.updatedAt = updatedAt;
    return this;
  }
```

(placed alphabetically among the other `with*` methods).

- [ ] **Step 4: Replace the repository interface**

```bash
git mv src/modules/family/domain/repository/familyRepository.ts src/modules/family/domain/repository/IFamilyRepository.ts
```

Replace the file content:

```ts
import FamilyEntity from '@family/domain/entity/FamilyEntity';

export type IFamilyRepository = {
  createFamily(params: CreateFamilyRepositoryParams): Promise<FamilyEntity>;
  deleteFamily(id: string): Promise<void>;
  getFamilies(userId: string): Promise<FamilyEntity[]>;
  getFamilyById(familyId: string): Promise<undefined | FamilyEntity>;
  isFamilyMember(params: IsFamilyMemberRepositoryParams): Promise<boolean>;
  updateFamily(params: UpdateFamilyRepositoryParams): Promise<FamilyEntity>;
};

interface CreateFamilyRepositoryParams {
  name: string;
  ownerEmail: string;
  ownerId: string;
}
interface IsFamilyMemberRepositoryParams {
  familyId: string;
  userId: string;
}
interface UpdateFamilyRepositoryParams {
  id: string;
  name: string;
}

export {
  CreateFamilyRepositoryParams,
  IsFamilyMemberRepositoryParams,
  UpdateFamilyRepositoryParams,
};
```

`src/modules/family/domain/repository/index.ts`:

```ts
export * from './familyMemberRepository';
export * from './IFamilyRepository';
```

- [ ] **Step 5: Run to verify it passes**

Run: `yarn jest src/modules/family/domain && yarn type-check`
Expected: PASS; type-check passes (nothing else imported the old `FamilyRepository` type — `grep -rn "FamilyRepository" src` should only show the new names and `FamilyMemberRepository`).

- [ ] **Step 6: Commit**

```bash
git add src/modules/family/domain
git commit -m "feat(family): add entity timestamps and IFamilyRepository contract" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Data layer — mapper, datasource, repository

**Files:**

- Create: `src/modules/family/data/repository/datasource/IFamilyDatasource.ts`
- Create: `src/modules/family/data/datasource/mapper/FamilyMapper/{index.ts,index.test.ts,index.mocks.ts}`
- Create: `src/modules/family/data/datasource/FamilyDatasource/{index.ts,index.test.ts,index.mocks.ts}`
- Create: `src/modules/family/data/repository/FamilyRepository/{index.ts,index.test.ts,index.mocks.ts}`

**Interfaces:**

- Consumes: Task 1 Prisma types, Task 2 `IFamilyRepository` + `FamilyEntity`.
- Produces:

  ```ts
  interface IFamilyDatasource {
    create(params: { email: string; name: string; owner_id: string }): Promise<Family>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<null | Family>;
    findByUserId(userId: string): Promise<Family[]>;
    isMember(params: { familyId: string; userId: string }): Promise<boolean>;
    update(params: { id: string; name: string }): Promise<Family>;
  }
  class FamilyRepository implements IFamilyRepository   // token 'IFamilyDatasource' injected
  class FamilyMapper { static toDomain(raw: Family): FamilyEntity }
  ```

- [ ] **Step 1: Write the failing mapper test + mocks**

`FamilyMapper/index.mocks.ts`:

```ts
import { faker } from '@faker-js/faker';

import { Family } from '@db/client';

// region Mocks

const rawFamilyMock: Family = {
  created_at: faker.date.past(),
  id: faker.string.uuid(),
  name: `Family ${faker.person.lastName()}`,
  owner_id: faker.string.uuid(),
  updated_at: faker.date.recent(),
};

// endregion

export const mocks = {
  raw: rawFamilyMock,
};
```

`FamilyMapper/index.test.ts`:

```ts
import { FamilyMapper } from './index';
import { mocks } from './index.mocks';

describe('FamilyMapper', () => {
  describe('toDomain', () => {
    it('SHOULD map every column to the entity', () => {
      const result = FamilyMapper.toDomain(mocks.raw);

      expect(result).toEqual({
        createdAt: mocks.raw.created_at,
        id: mocks.raw.id,
        name: mocks.raw.name,
        ownerId: mocks.raw.owner_id,
        updatedAt: mocks.raw.updated_at,
      });
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest src/modules/family/data/datasource/mapper`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Implement the mapper**

`FamilyMapper/index.ts`:

```ts
import { Family } from '@db/client';
import FamilyEntity from '@family/domain/entity/FamilyEntity';

export class FamilyMapper {
  static toDomain(raw: Family): FamilyEntity {
    return new FamilyEntity({
      createdAt: raw.created_at,
      id: raw.id,
      name: raw.name,
      ownerId: raw.owner_id,
      updatedAt: raw.updated_at,
    });
  }
}
```

Run: `yarn jest src/modules/family/data/datasource/mapper` → PASS.

- [ ] **Step 4: Write the datasource interface, then the failing datasource test + mocks**

`src/modules/family/data/repository/datasource/IFamilyDatasource.ts`:

```ts
import { Family } from '@db/client';

export interface CreateFamilyDatasourceParams {
  email: string;
  name: string;
  owner_id: string;
}
export interface IsMemberDatasourceParams {
  familyId: string;
  userId: string;
}
export interface UpdateFamilyDatasourceParams {
  id: string;
  name: string;
}

export interface IFamilyDatasource {
  create(params: CreateFamilyDatasourceParams): Promise<Family>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<null | Family>;
  findByUserId(userId: string): Promise<Family[]>;
  isMember(params: IsMemberDatasourceParams): Promise<boolean>;
  update(params: UpdateFamilyDatasourceParams): Promise<Family>;
}
```

`FamilyDatasource/index.mocks.ts`:

```ts
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { Family } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { FamilyDatasource } from './index';

// region Mocks

const familyMock: Family = {
  created_at: faker.date.past(),
  id: faker.string.uuid(),
  name: 'Example Family',
  owner_id: faker.string.uuid(),
  updated_at: faker.date.recent(),
};

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateSpy = jest.fn();
const memberCountSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    family: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
    familyMember: { count: memberCountSpy },
  },
} as unknown as Database;

let setup: FamilyDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FamilyDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FamilyDatasource>(FamilyDatasource);
});

const mocks = {
  family: familyMock,
  userId: faker.string.uuid(),
};

const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  memberCount: memberCountSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
```

`FamilyDatasource/index.test.ts`:

```ts
import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD create the family AND the joined owner membership in ONE nested write', async () => {
    spies.create.mockResolvedValue(mocks.family);

    const result = await setup.create({
      email: 'test@example.com',
      name: mocks.family.name,
      owner_id: mocks.userId,
    });

    expect(result).toEqual(mocks.family);
    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({
      data: {
        members: {
          create: { email: 'test@example.com', joined_at: expect.any(Date), user_id: mocks.userId },
        },
        name: mocks.family.name,
        owner_id: mocks.userId,
      },
    });
  });

  it('SHOULD propagate the error WHEN the nested write fails (nothing is persisted by Prisma)', async () => {
    spies.create.mockRejectedValue(new Error('unique violation'));

    await expect(
      setup.create({ email: 'test@example.com', name: 'x', owner_id: mocks.userId }),
    ).rejects.toThrow('unique violation');
  });
});

describe('Method delete', () => {
  it('SHOULD delete by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.family.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.family.id } });
  });
});

describe('Method findById', () => {
  it('SHOULD return the family WHEN found', async () => {
    spies.findUnique.mockResolvedValue(mocks.family);

    expect(await setup.findById(mocks.family.id)).toEqual(mocks.family);
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.family.id } });
  });

  it('SHOULD return null WHEN NOT found', async () => {
    spies.findUnique.mockResolvedValue(null);

    expect(await setup.findById(mocks.family.id)).toBeNull();
  });
});

describe('Method findByUserId', () => {
  it('SHOULD query ONLY families with a JOINED membership of the user', async () => {
    spies.findMany.mockResolvedValue([mocks.family]);

    const result = await setup.findByUserId(mocks.userId);

    expect(result).toEqual([mocks.family]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      where: { members: { some: { joined_at: { not: null }, user_id: mocks.userId } } },
    });
  });
});

describe('Method isMember', () => {
  it('SHOULD return true WHEN a joined membership exists', async () => {
    spies.memberCount.mockResolvedValue(1);

    const result = await setup.isMember({ familyId: mocks.family.id, userId: mocks.userId });

    expect(result).toBe(true);
    expect(spies.memberCount).toHaveBeenCalledWith({
      where: { family_id: mocks.family.id, joined_at: { not: null }, user_id: mocks.userId },
    });
  });

  it('SHOULD return false WHEN there is no joined membership (pending invite or stranger)', async () => {
    spies.memberCount.mockResolvedValue(0);

    expect(await setup.isMember({ familyId: mocks.family.id, userId: mocks.userId })).toBe(false);
  });
});

describe('Method update', () => {
  it('SHOULD update ONLY the name AND return the family', async () => {
    spies.update.mockResolvedValue(mocks.family);

    const result = await setup.update({ id: mocks.family.id, name: 'Renamed' });

    expect(result).toEqual(mocks.family);
    expect(spies.update).toHaveBeenCalledWith({
      data: { name: 'Renamed' },
      where: { id: mocks.family.id },
    });
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `yarn jest src/modules/family/data/datasource/FamilyDatasource`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 6: Implement the datasource**

`FamilyDatasource/index.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { Family } from '@db/client';
import {
  CreateFamilyDatasourceParams,
  IFamilyDatasource,
  IsMemberDatasourceParams,
  UpdateFamilyDatasourceParams,
} from '@family/data/repository/datasource/IFamilyDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FamilyDatasource implements IFamilyDatasource {
  constructor(private readonly db: Database) {}

  // A nested write: Prisma runs the family insert and the owner membership insert in ONE transaction.
  async create(params: CreateFamilyDatasourceParams): Promise<Family> {
    const { email, name, owner_id } = params;

    return this.db.client.family.create({
      data: {
        members: {
          create: { email, joined_at: new Date(), user_id: owner_id },
        },
        name,
        owner_id,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.family.deleteMany({ where: { id } });
  }

  async findById(id: string): Promise<null | Family> {
    return this.db.client.family.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Family[]> {
    return this.db.client.family.findMany({
      where: { members: { some: { joined_at: { not: null }, user_id: userId } } },
    });
  }

  async isMember(params: IsMemberDatasourceParams): Promise<boolean> {
    const count = await this.db.client.familyMember.count({
      where: { family_id: params.familyId, joined_at: { not: null }, user_id: params.userId },
    });

    return count > 0;
  }

  async update(params: UpdateFamilyDatasourceParams): Promise<Family> {
    return this.db.client.family.update({
      data: { name: params.name },
      where: { id: params.id },
    });
  }
}
```

Run: `yarn jest src/modules/family/data/datasource` → PASS.

- [ ] **Step 7: Write the failing repository test + mocks**

`FamilyRepository/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import { Family } from '@db/client';
import { FamilyMapper } from '@family/data/datasource/mapper/FamilyMapper';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { FamilyRepository } from './index';

// region Mocks

jest.mock('@family/data/datasource/mapper/FamilyMapper');

const familyEntityMock = new FamilyEntityFixture().build();
const familyPersistenceMock = { id: familyEntityMock.id } as Family;

const familyDatasourceMock = {
  create: jest.fn().mockResolvedValue(familyPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(familyPersistenceMock),
  findByUserId: jest.fn().mockResolvedValue([familyPersistenceMock]),
  isMember: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockResolvedValue(familyPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FamilyMapper.toDomain);

// endregion Spies

let setup: FamilyRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(familyEntityMock);

  const module = await Test.createTestingModule({
    providers: [FamilyRepository, { provide: 'IFamilyDatasource', useValue: familyDatasourceMock }],
  }).compile();

  setup = module.get<FamilyRepository>(FamilyRepository);
});

const mocks = {
  familyDatasource: familyDatasourceMock,
  familyEntity: familyEntityMock,
  familyPersistence: familyPersistenceMock,
};

const spies = {
  familyDatasource: familyDatasourceMock,
  mapper: { toDomain: mapperToDomainSpy },
};

export { mocks, setup, spies };
```

`FamilyRepository/index.test.ts`:

```ts
import { mocks, setup, spies } from './index.mocks';

describe('createFamily', () => {
  it('SHOULD map the params to the datasource AND return the entity', async () => {
    const result = await setup.createFamily({
      name: 'Example Family',
      ownerEmail: 'test@example.com',
      ownerId: mocks.familyEntity.ownerId,
    });

    expect(spies.familyDatasource.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Example Family',
      owner_id: mocks.familyEntity.ownerId,
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.familyPersistence);
    expect(result).toEqual(mocks.familyEntity);
  });
});

describe('deleteFamily', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteFamily(mocks.familyEntity.id);

    expect(spies.familyDatasource.delete).toHaveBeenCalledWith(mocks.familyEntity.id);
  });
});

describe('getFamilies', () => {
  it('SHOULD return the mapped families of the user', async () => {
    const result = await setup.getFamilies('user-id-123');

    expect(spies.familyDatasource.findByUserId).toHaveBeenCalledWith('user-id-123');
    expect(result).toEqual([mocks.familyEntity]);
  });

  it('SHOULD return an empty array WHEN the user has no family', async () => {
    spies.familyDatasource.findByUserId.mockResolvedValueOnce([]);

    expect(await setup.getFamilies('user-id-123')).toEqual([]);
  });
});

describe('getFamilyById', () => {
  it('SHOULD return the entity WHEN found', async () => {
    expect(await setup.getFamilyById(mocks.familyEntity.id)).toEqual(mocks.familyEntity);
  });

  it('SHOULD return undefined WHEN NOT found', async () => {
    spies.familyDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.getFamilyById(mocks.familyEntity.id)).toBeUndefined();
    expect(spies.mapper.toDomain).not.toHaveBeenCalled();
  });
});

describe('isFamilyMember', () => {
  it('SHOULD delegate to the datasource', async () => {
    const params = { familyId: mocks.familyEntity.id, userId: 'user-id-123' };

    expect(await setup.isFamilyMember(params)).toBe(true);
    expect(spies.familyDatasource.isMember).toHaveBeenCalledWith(params);
  });
});

describe('updateFamily', () => {
  it('SHOULD update AND return the mapped entity', async () => {
    const result = await setup.updateFamily({ id: mocks.familyEntity.id, name: 'Renamed' });

    expect(spies.familyDatasource.update).toHaveBeenCalledWith({
      id: mocks.familyEntity.id,
      name: 'Renamed',
    });
    expect(result).toEqual(mocks.familyEntity);
  });
});
```

- [ ] **Step 8: Run to verify it fails, implement, verify it passes**

Run: `yarn jest src/modules/family/data/repository` → FAIL (`Cannot find module './index'`).

`FamilyRepository/index.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import { FamilyMapper } from '@family/data/datasource/mapper/FamilyMapper';
import { IFamilyDatasource } from '@family/data/repository/datasource/IFamilyDatasource';
import FamilyEntity from '@family/domain/entity/FamilyEntity';
import {
  CreateFamilyRepositoryParams,
  IFamilyRepository,
  IsFamilyMemberRepositoryParams,
  UpdateFamilyRepositoryParams,
} from '@family/domain/repository';

@Injectable()
export class FamilyRepository implements IFamilyRepository {
  constructor(@Inject('IFamilyDatasource') private readonly familyDatasource: IFamilyDatasource) {}

  async createFamily(params: CreateFamilyRepositoryParams): Promise<FamilyEntity> {
    const result = await this.familyDatasource.create({
      email: params.ownerEmail,
      name: params.name,
      owner_id: params.ownerId,
    });

    return FamilyMapper.toDomain(result);
  }

  async deleteFamily(id: string): Promise<void> {
    await this.familyDatasource.delete(id);
  }

  async getFamilies(userId: string): Promise<FamilyEntity[]> {
    const result = await this.familyDatasource.findByUserId(userId);

    return result.map((family) => FamilyMapper.toDomain(family));
  }

  async getFamilyById(familyId: string): Promise<undefined | FamilyEntity> {
    const result = await this.familyDatasource.findById(familyId);

    return result ? FamilyMapper.toDomain(result) : undefined;
  }

  async isFamilyMember(params: IsFamilyMemberRepositoryParams): Promise<boolean> {
    return this.familyDatasource.isMember(params);
  }

  async updateFamily(params: UpdateFamilyRepositoryParams): Promise<FamilyEntity> {
    const result = await this.familyDatasource.update({ id: params.id, name: params.name });

    return FamilyMapper.toDomain(result);
  }
}
```

Run: `yarn jest src/modules/family/data && yarn type-check` → PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/family/data
git commit -m "feat(family): add family datasource, mapper and repository" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Application — read use cases and cross-module authorization

**Files:**

- Create: `src/modules/family/application/dto/FamilyUseCaseOutput.ts`, `FamilyAccess.ts`
- Create: `src/modules/family/application/use-case/GetUserFamiliesUseCase/`, `GetFamilyByIdUseCase/`, `GetUserFamilyIdsUseCase/`, `CheckFamilyMembershipUseCase/` — each `{index.ts,index.test.ts,index.mocks.ts}`

**Interfaces:**

- Consumes: `IFamilyRepository` (token `'IFamilyRepository'`), `FamilyEntityFixture`.
- Produces:

  ```ts
  type FamilyUseCaseOutput = { createdAt: Date; id: string; name: string; ownerId: string; updatedAt: Date };
  function toFamilyUseCaseOutput(family: FamilyEntity): FamilyUseCaseOutput;
  type FamilyAccessInput = { familyId: string; userId: string };
  GetUserFamiliesUseCase.execute({ userId: string }): Promise<FamilyUseCaseOutput[]>   // sorted
  GetFamilyByIdUseCase.execute(FamilyAccessInput): Promise<FamilyUseCaseOutput>        // 404 for non-member
  GetUserFamilyIdsUseCase.execute(userId: string): Promise<string[]>                   // exported contract
  CheckFamilyMembershipUseCase.execute(FamilyAccessInput): Promise<boolean>            // exported contract
  ```

- [ ] **Step 1: DTOs**

`dto/FamilyUseCaseOutput.ts`:

```ts
import FamilyEntity from '@family/domain/entity/FamilyEntity';

export type FamilyUseCaseOutput = {
  createdAt: Date;
  id: string;
  name: string;
  ownerId: string;
  updatedAt: Date;
};

export function toFamilyUseCaseOutput(family: FamilyEntity): FamilyUseCaseOutput {
  return {
    createdAt: family.createdAt,
    id: family.id,
    name: family.name,
    ownerId: family.ownerId,
    updatedAt: family.updatedAt,
  };
}
```

`dto/FamilyAccess.ts`:

```ts
export type FamilyAccessInput = {
  familyId: string;
  userId: string;
};
```

- [ ] **Step 2: Failing tests — `CheckFamilyMembershipUseCase` and `GetUserFamilyIdsUseCase`**

`CheckFamilyMembershipUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import { CheckFamilyMembershipUseCase } from './index';

// region Mocks

const inputMock = { familyId: 'family-id-123', userId: 'user-id-123' };
const familyRepositoryMock = { isFamilyMember: jest.fn().mockResolvedValue(true) };

// endregion Mocks

let setup: CheckFamilyMembershipUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CheckFamilyMembershipUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(CheckFamilyMembershipUseCase);
});

const mocks = { familyRepository: familyRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
```

`CheckFamilyMembershipUseCase/index.test.ts`:

```ts
import { mocks, setup } from './index.mocks';

it('SHOULD return true WHEN the user is a joined member', async () => {
  expect(await setup.execute(mocks.input)).toBe(true);
  expect(mocks.familyRepository.isFamilyMember).toHaveBeenCalledWith(mocks.input);
});

it('SHOULD return false WHEN the user is NOT a joined member (pending invite or stranger)', async () => {
  mocks.familyRepository.isFamilyMember.mockResolvedValueOnce(false);

  expect(await setup.execute(mocks.input)).toBe(false);
});
```

`GetUserFamilyIdsUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { GetUserFamilyIdsUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const familiesMock = [fixture.build(), fixture.build()];
const familyRepositoryMock = { getFamilies: jest.fn().mockResolvedValue(familiesMock) };

// endregion Mocks

let setup: GetUserFamilyIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetUserFamilyIdsUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetUserFamilyIdsUseCase);
});

const mocks = {
  families: familiesMock,
  familyRepository: familyRepositoryMock,
  userId: 'user-id-123',
};
const spies = {};

export { mocks, setup, spies };
```

`GetUserFamilyIdsUseCase/index.test.ts`:

```ts
import { mocks, setup } from './index.mocks';

it('SHOULD return the ids of the families the user belongs to', async () => {
  const result = await setup.execute(mocks.userId);

  expect(mocks.familyRepository.getFamilies).toHaveBeenCalledWith(mocks.userId);
  expect(result).toEqual(mocks.families.map((family) => family.id));
});

it('SHOULD return an empty array WHEN the user belongs to no family', async () => {
  mocks.familyRepository.getFamilies.mockResolvedValueOnce([]);

  expect(await setup.execute(mocks.userId)).toEqual([]);
});
```

- [ ] **Step 3: Run to verify they fail, then implement**

Run: `yarn jest src/modules/family/application` → FAIL (`Cannot find module './index'`).

`CheckFamilyMembershipUseCase/index.ts`:

```ts
import { Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class CheckFamilyMembershipUseCase implements UseCaseWithParams<FamilyAccessInput, boolean> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: FamilyAccessInput): Promise<boolean> {
    return this.familyRepository.isFamilyMember({
      familyId: params.familyId,
      userId: params.userId,
    });
  }
}
```

`GetUserFamilyIdsUseCase/index.ts`:

```ts
import { Inject } from '@nestjs/common';

import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetUserFamilyIdsUseCase implements UseCaseWithParams<string, string[]> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(userId: string): Promise<string[]> {
    const families = await this.familyRepository.getFamilies(userId);

    return families.map((family) => family.id);
  }
}
```

Run: `yarn jest src/modules/family/application` → PASS.

- [ ] **Step 4: Failing tests — `GetFamilyByIdUseCase`**

`GetFamilyByIdUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { GetFamilyByIdUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const inputMock = { familyId: familyMock.id, userId: 'user-id-123' };

const familyRepositoryMock = {
  getFamilyById: jest.fn().mockResolvedValue(familyMock),
  isFamilyMember: jest.fn().mockResolvedValue(true),
};

// endregion Mocks

let setup: GetFamilyByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetFamilyByIdUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetFamilyByIdUseCase);
});

const mocks = { family: familyMock, familyRepository: familyRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
```

`GetFamilyByIdUseCase/index.test.ts`:

```ts
import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the family WHEN the user is a member', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.familyRepository.isFamilyMember).toHaveBeenCalledWith(mocks.input);
  expect(result).toEqual({
    createdAt: mocks.family.createdAt,
    id: mocks.family.id,
    name: mocks.family.name,
    ownerId: mocks.family.ownerId,
    updatedAt: mocks.family.updatedAt,
  });
});

it('SHOULD throw NotFoundException WHEN the user is NOT a member AND NOT read the family', async () => {
  mocks.familyRepository.isFamilyMember.mockResolvedValueOnce(false);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.familyRepository.getFamilyById).not.toHaveBeenCalled();
});

it('SHOULD throw NotFoundException WHEN the family vanished between the checks', async () => {
  mocks.familyRepository.getFamilyById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});
```

Run → FAIL. Implement `GetFamilyByIdUseCase/index.ts`:

```ts
import { Inject, NotFoundException } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class GetFamilyByIdUseCase implements UseCaseWithParams<
  FamilyAccessInput,
  FamilyUseCaseOutput
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: FamilyAccessInput): Promise<FamilyUseCaseOutput> {
    // Non-members get 404 so the existence of the family is never revealed.
    const isMember = await this.familyRepository.isFamilyMember({
      familyId: params.familyId,
      userId: params.userId,
    });

    if (!isMember) {
      throw new NotFoundException();
    }

    const family = await this.familyRepository.getFamilyById(params.familyId);

    if (!family) {
      throw new NotFoundException();
    }

    return toFamilyUseCaseOutput(family);
  }
}
```

Run → PASS.

- [ ] **Step 5: Failing tests — `GetUserFamiliesUseCase` (sorting)**

`GetUserFamiliesUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { GetUserFamiliesUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const banana = fixture.withName('banana').withCreatedAt(new Date('2026-01-01')).build();
const appleNewer = fixture.withName('apple').withCreatedAt(new Date('2026-01-02')).build();
const appleUpperOlder = fixture.withName('Apple').withCreatedAt(new Date('2026-01-01')).build();

const familyRepositoryMock = {
  getFamilies: jest.fn().mockResolvedValue([banana, appleNewer, appleUpperOlder]),
};

// endregion Mocks

let setup: GetUserFamiliesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetUserFamiliesUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetUserFamiliesUseCase);
});

const mocks = {
  expectedOrderIds: [appleUpperOlder.id, appleNewer.id, banana.id],
  familyRepository: familyRepositoryMock,
  userId: 'user-id-123',
};
const spies = {};

export { mocks, setup, spies };
```

`GetUserFamiliesUseCase/index.test.ts`:

```ts
import { mocks, setup } from './index.mocks';

it('SHOULD sort by name case-insensitively, then by createdAt ascending', async () => {
  const result = await setup.execute({ userId: mocks.userId });

  expect(mocks.familyRepository.getFamilies).toHaveBeenCalledWith(mocks.userId);
  expect(result.map((family) => family.id)).toEqual(mocks.expectedOrderIds);
});

it('SHOULD return an empty array WHEN the user belongs to no family', async () => {
  mocks.familyRepository.getFamilies.mockResolvedValueOnce([]);

  expect(await setup.execute({ userId: mocks.userId })).toEqual([]);
});
```

Run → FAIL. Implement `GetUserFamiliesUseCase/index.ts`:

```ts
import { Inject } from '@nestjs/common';

import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import FamilyEntity from '@family/domain/entity/FamilyEntity';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

function compareFamilies(a: FamilyEntity, b: FamilyEntity): number {
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();

  if (nameA !== nameB) {
    return nameA < nameB ? -1 : 1;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
}

export class GetUserFamiliesUseCase implements UseCaseWithParams<
  { userId: string },
  FamilyUseCaseOutput[]
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: { userId: string }): Promise<FamilyUseCaseOutput[]> {
    const families = await this.familyRepository.getFamilies(params.userId);

    return [...families].sort(compareFamilies).map((family) => toFamilyUseCaseOutput(family));
  }
}
```

Run: `yarn jest src/modules/family/application && yarn type-check` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/family/application
git commit -m "feat(family): add read and membership use cases" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Application — write use cases and `FamilyModule`

**Files:**

- Create: `src/modules/family/application/dto/CreateFamily.ts`, `UpdateFamily.ts`
- Create: `src/modules/family/application/use-case/{CreateFamilyUseCase,EnsureFamilyOwnerUseCase,UpdateFamilyUseCase,DeleteFamilyUseCase}/{index.ts,index.test.ts,index.mocks.ts}`
- Create: `src/modules/family/family.module.ts`

**Interfaces:**

- Consumes: Task 4 `GetFamilyByIdUseCase`, `FamilyAccessInput`, `FamilyUseCaseOutput`, `toFamilyUseCaseOutput`.
- Produces:

  ```ts
  type CreateFamilyInput = { name: string; ownerEmail: string; ownerId: string };
  type UpdateFamilyInput = { familyId: string; name: string; userId: string };
  CreateFamilyUseCase.execute(CreateFamilyInput): Promise<FamilyUseCaseOutput>            // validates name → 400
  EnsureFamilyOwnerUseCase.execute(FamilyAccessInput): Promise<FamilyUseCaseOutput>       // 404 non-member, 403 non-owner
  UpdateFamilyUseCase.execute(UpdateFamilyInput): Promise<FamilyUseCaseOutput>
  DeleteFamilyUseCase.execute(FamilyAccessInput): Promise<void>
  FamilyModule  // exports all 8 use cases
  ```

- [ ] **Step 1: DTOs**

`dto/CreateFamily.ts`:

```ts
import { z } from 'zod';

export const FamilyNameSchema = z.string().trim().min(1).max(50);

export const CreateFamilySchema = z.object({
  name: FamilyNameSchema,
  ownerEmail: z.string().min(1),
  ownerId: z.string().min(1),
});

export type CreateFamilyInput = z.infer<typeof CreateFamilySchema>;
```

`dto/UpdateFamily.ts`:

```ts
import { z } from 'zod';

import { FamilyNameSchema } from '@family/application/dto/CreateFamily';

export const UpdateFamilySchema = z.object({
  familyId: z.string().min(1),
  name: FamilyNameSchema,
  userId: z.string().min(1),
});

export type UpdateFamilyInput = z.infer<typeof UpdateFamilySchema>;
```

- [ ] **Step 2: Failing tests — `CreateFamilyUseCase`**

`CreateFamilyUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { CreateFamilyUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const inputMock = {
  name: 'Example Family',
  ownerEmail: 'test@example.com',
  ownerId: familyMock.ownerId,
};

const familyRepositoryMock = { createFamily: jest.fn().mockResolvedValue(familyMock) };

// endregion Mocks

let setup: CreateFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateFamilyUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateFamilyUseCase);
});

const mocks = { family: familyMock, familyRepository: familyRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
```

`CreateFamilyUseCase/index.test.ts`:

```ts
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD create the family with the owner data AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.familyRepository.createFamily).toHaveBeenCalledWith(mocks.input);
  expect(result).toEqual({
    createdAt: mocks.family.createdAt,
    id: mocks.family.id,
    name: mocks.family.name,
    ownerId: mocks.family.ownerId,
    updatedAt: mocks.family.updatedAt,
  });
});

it('SHOULD trim the name before persisting', async () => {
  await setup.execute({ ...mocks.input, name: '  Example Family ' });

  expect(mocks.familyRepository.createFamily).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Example Family' }),
  );
});

it('SHOULD accept a name of exactly 50 characters (after trimming)', async () => {
  await setup.execute({ ...mocks.input, name: `  ${'a'.repeat(50)}  ` });

  expect(mocks.familyRepository.createFamily).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'a'.repeat(50) }),
  );
});

it.each([
  ['empty', ''],
  ['whitespace-only', '   '],
  ['51 characters', 'a'.repeat(51)],
])('SHOULD throw ValidationError AND persist nothing WHEN the name is %s', async (_label, name) => {
  await expect(setup.execute({ ...mocks.input, name })).rejects.toThrow(ValidationError);
  expect(mocks.familyRepository.createFamily).not.toHaveBeenCalled();
});
```

Run: `yarn jest src/modules/family/application/use-case/CreateFamilyUseCase` → FAIL. Implement `CreateFamilyUseCase/index.ts`:

```ts
import { Inject } from '@nestjs/common';

import { CreateFamilyInput, CreateFamilySchema } from '@family/application/dto/CreateFamily';
import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class CreateFamilyUseCase implements UseCaseWithParams<
  CreateFamilyInput,
  FamilyUseCaseOutput
> {
  constructor(@Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository) {}

  async execute(params: CreateFamilyInput): Promise<FamilyUseCaseOutput> {
    const input = validate(CreateFamilySchema, params);

    const family = await this.familyRepository.createFamily({
      name: input.name,
      ownerEmail: input.ownerEmail,
      ownerId: input.ownerId,
    });

    return toFamilyUseCaseOutput(family);
  }
}
```

Run → PASS.

- [ ] **Step 3: Failing tests — `EnsureFamilyOwnerUseCase`**

`EnsureFamilyOwnerUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { EnsureFamilyOwnerUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const ownerInputMock = { familyId: familyMock.id, userId: familyMock.ownerId };
const memberInputMock = { familyId: familyMock.id, userId: 'member-user-id-456' };

const getFamilyByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(familyMock) };

// endregion Mocks

let setup: EnsureFamilyOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      EnsureFamilyOwnerUseCase,
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
    ],
  }).compile();

  setup = module.get(EnsureFamilyOwnerUseCase);
});

const mocks = {
  family: familyMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  memberInput: memberInputMock,
  ownerInput: ownerInputMock,
};
const spies = {};

export { mocks, setup, spies };
```

`EnsureFamilyOwnerUseCase/index.test.ts`:

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the family WHEN the user is the owner', async () => {
  const result = await setup.execute(mocks.ownerInput);

  expect(mocks.getFamilyByIdUseCase.execute).toHaveBeenCalledWith(mocks.ownerInput);
  expect(result).toBe(mocks.family);
});

it('SHOULD throw ForbiddenException WHEN the user is a member but NOT the owner', async () => {
  await expect(setup.execute(mocks.memberInput)).rejects.toThrow(ForbiddenException);
});

it('SHOULD propagate NotFoundException WHEN the user is NOT a member (404 wins over 403)', async () => {
  mocks.getFamilyByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

  await expect(setup.execute(mocks.memberInput)).rejects.toThrow(NotFoundException);
});
```

Run → FAIL. Implement `EnsureFamilyOwnerUseCase/index.ts`:

```ts
import { ForbiddenException, Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import { FamilyUseCaseOutput } from '@family/application/dto/FamilyUseCaseOutput';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class EnsureFamilyOwnerUseCase implements UseCaseWithParams<
  FamilyAccessInput,
  FamilyUseCaseOutput
> {
  constructor(
    @Inject(GetFamilyByIdUseCase) private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
  ) {}

  async execute(params: FamilyAccessInput): Promise<FamilyUseCaseOutput> {
    // Throws NotFoundException first for non-members (404 before 403).
    const family = await this.getFamilyByIdUseCase.execute(params);

    if (family.ownerId !== params.userId) {
      throw new ForbiddenException();
    }

    return family;
  }
}
```

Run → PASS.

- [ ] **Step 4: Failing tests — `UpdateFamilyUseCase`**

`UpdateFamilyUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { UpdateFamilyUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const familyMock = fixture.build();
const renamedMock = { ...familyMock, name: 'Renamed Family' };
const inputMock = { familyId: familyMock.id, name: 'Renamed Family', userId: familyMock.ownerId };

const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(familyMock) };
const familyRepositoryMock = { updateFamily: jest.fn().mockResolvedValue(renamedMock) };

// endregion Mocks

let setup: UpdateFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      UpdateFamilyUseCase,
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateFamilyUseCase);
});

const mocks = {
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyRepository: familyRepositoryMock,
  input: inputMock,
  renamed: renamedMock,
};
const spies = {};

export { mocks, setup, spies };
```

`UpdateFamilyUseCase/index.test.ts`:

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD check the owner, rename the family AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith({
    familyId: mocks.input.familyId,
    userId: mocks.input.userId,
  });
  expect(mocks.familyRepository.updateFamily).toHaveBeenCalledWith({
    id: mocks.input.familyId,
    name: 'Renamed Family',
  });
  expect(result.name).toBe(mocks.renamed.name);
  expect(result.updatedAt).toBe(mocks.renamed.updatedAt);
});

it('SHOULD trim the new name', async () => {
  await setup.execute({ ...mocks.input, name: '  Renamed Family ' });

  expect(mocks.familyRepository.updateFamily).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Renamed Family' }),
  );
});

it.each([
  ['empty', ''],
  ['whitespace-only', '  '],
  ['51 characters', 'a'.repeat(51)],
])('SHOULD throw ValidationError WHEN the name is %s', async (_label, name) => {
  await expect(setup.execute({ ...mocks.input, name })).rejects.toThrow(ValidationError);
  expect(mocks.familyRepository.updateFamily).not.toHaveBeenCalled();
});

it.each([
  ['non-member (404)', new NotFoundException()],
  ['non-owner (403)', new ForbiddenException()],
])('SHOULD NOT update WHEN the caller is a %s', async (_label, error) => {
  mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toThrow(error);
  expect(mocks.familyRepository.updateFamily).not.toHaveBeenCalled();
});
```

Run → FAIL. Implement `UpdateFamilyUseCase/index.ts`:

```ts
import { Inject } from '@nestjs/common';

import {
  FamilyUseCaseOutput,
  toFamilyUseCaseOutput,
} from '@family/application/dto/FamilyUseCaseOutput';
import { UpdateFamilyInput, UpdateFamilySchema } from '@family/application/dto/UpdateFamily';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class UpdateFamilyUseCase implements UseCaseWithParams<
  UpdateFamilyInput,
  FamilyUseCaseOutput
> {
  constructor(
    @Inject(EnsureFamilyOwnerUseCase)
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    @Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository,
  ) {}

  async execute(params: UpdateFamilyInput): Promise<FamilyUseCaseOutput> {
    const input = validate(UpdateFamilySchema, params);

    await this.ensureFamilyOwnerUseCase.execute({
      familyId: input.familyId,
      userId: input.userId,
    });

    const family = await this.familyRepository.updateFamily({
      id: input.familyId,
      name: input.name,
    });

    return toFamilyUseCaseOutput(family);
  }
}
```

Run → PASS.

- [ ] **Step 5: Failing tests — `DeleteFamilyUseCase`**

`DeleteFamilyUseCase/index.mocks.ts`:

```ts
import { Test } from '@nestjs/testing';

import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';

import { DeleteFamilyUseCase } from './index';

// region Mocks

const inputMock = { familyId: 'family-id-123', userId: 'user-id-123' };

const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const familyRepositoryMock = { deleteFamily: jest.fn().mockResolvedValue(undefined) };

// endregion Mocks

let setup: DeleteFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      DeleteFamilyUseCase,
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteFamilyUseCase);
});

const mocks = {
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyRepository: familyRepositoryMock,
  input: inputMock,
};
const spies = {};

export { mocks, setup, spies };
```

`DeleteFamilyUseCase/index.test.ts`:

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD check the owner AND delete the family', async () => {
  await setup.execute(mocks.input);

  expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith(mocks.input);
  expect(mocks.familyRepository.deleteFamily).toHaveBeenCalledWith(mocks.input.familyId);
});

it.each([
  ['unknown or non-member (404)', new NotFoundException()],
  ['non-owner (403)', new ForbiddenException()],
])('SHOULD NOT delete WHEN the caller is %s', async (_label, error) => {
  mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toThrow(error);
  expect(mocks.familyRepository.deleteFamily).not.toHaveBeenCalled();
});
```

Run → FAIL. Implement `DeleteFamilyUseCase/index.ts`:

```ts
import { Inject } from '@nestjs/common';

import { FamilyAccessInput } from '@family/application/dto/FamilyAccess';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { IFamilyRepository } from '@family/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export class DeleteFamilyUseCase implements UseCaseWithParams<FamilyAccessInput, void> {
  constructor(
    @Inject(EnsureFamilyOwnerUseCase)
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    @Inject('IFamilyRepository') private readonly familyRepository: IFamilyRepository,
  ) {}

  async execute(params: FamilyAccessInput): Promise<void> {
    await this.ensureFamilyOwnerUseCase.execute(params);

    // Memberships are removed by the ON DELETE CASCADE FK.
    await this.familyRepository.deleteFamily(params.familyId);
  }
}
```

Run → PASS.

- [ ] **Step 6: The module**

`src/modules/family/family.module.ts` (excluded from coverage like other modules):

```ts
import { Module } from '@nestjs/common';

import { CheckFamilyMembershipUseCase } from '@family/application/use-case/CheckFamilyMembershipUseCase';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FamilyDatasource } from '@family/data/datasource/FamilyDatasource';
import { FamilyRepository } from '@family/data/repository/FamilyRepository';

const useCases = [
  CheckFamilyMembershipUseCase,
  CreateFamilyUseCase,
  DeleteFamilyUseCase,
  EnsureFamilyOwnerUseCase,
  GetFamilyByIdUseCase,
  GetUserFamiliesUseCase,
  GetUserFamilyIdsUseCase,
  UpdateFamilyUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IFamilyRepository', useClass: FamilyRepository },
    { provide: 'IFamilyDatasource', useClass: FamilyDatasource },
  ],
})
export class FamilyModule {}
```

- [ ] **Step 7: Verify and commit**

Run: `yarn jest src/modules/family && yarn type-check`
Expected: all PASS.

```bash
git add src/modules/family
git commit -m "feat(family): add create, update, delete use cases and FamilyModule" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: API — DTOs, service, controller, module

**Files:**

- Create: `src/api/family/v1/dto/family.dto.ts`
- Create: `src/api/family/v1/family-records-checks.ts`
- Create: `src/api/family/v1/family.service.ts`, `family.service.mocks.ts`, `family.service.test.ts`
- Create: `src/api/family/v1/family.controller.ts`, `family.controller.mocks.ts`, `family.controller.test.ts`
- Create: `src/api/family/family.module.ts`
- Modify: `src/api/api.module.ts`

**Interfaces:**

- Consumes: all `family` use cases (Tasks 4–5), `FindUserByIdUseCase` (`@user/application/use-case/FindUserByIdUseCase`, output has `email`), `OwnerType` (`@shared/domain/entity/owner/OwnerEntity`), `validate`, `JwtPayload`.
- Produces:

  ```ts
  // family.dto.ts
  CreateFamilyApiSchema / UpdateFamilyApiSchema = z.object({ name: z.string().trim().min(1).max(50) })
  class CreateFamilyInput, UpdateFamilyInput, FamilyOutput  (createZodDto)
  // family-records-checks.ts
  const FAMILY_OWNED_RECORDS_CHECKS = 'FAMILY_OWNED_RECORDS_CHECKS';
  interface IOwnedRecordsCheck { execute(params: { owner: OwnerType; ownerId: string }): Promise<boolean> }
  // FamilyService
  create(userId: string, input: { name: string }): Promise<FamilyOutput>
  delete(userId: string, familyId: string): Promise<void>
  findAll(userId: string): Promise<FamilyOutput[]>
  findById(userId: string, familyId: string): Promise<FamilyOutput>
  update(userId: string, familyId: string, input: { name: string }): Promise<FamilyOutput>
  ```

- [ ] **Step 1: DTOs and the checks token**

`dto/family.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const FamilyNameApiSchema = z.string().trim().min(1).max(50);

export const CreateFamilyApiSchema = z.object({ name: FamilyNameApiSchema });
export const UpdateFamilyApiSchema = z.object({ name: FamilyNameApiSchema });

export const FamilyApiSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  name: z.string(),
  ownerId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

export class CreateFamilyInput extends createZodDto(CreateFamilyApiSchema) {}
export class FamilyOutput extends createZodDto(FamilyApiSchema) {}
export class UpdateFamilyInput extends createZodDto(UpdateFamilyApiSchema) {}
```

`family-records-checks.ts`:

```ts
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Injection token for the list of "does this owner still have records?" checks, one per owned module.
// Empty today (stock/finance have no use cases yet). Specs 005/006 register their use case here
// (see FamilyAPIModule).
export const FAMILY_OWNED_RECORDS_CHECKS = 'FAMILY_OWNED_RECORDS_CHECKS';

export interface IOwnedRecordsCheck {
  execute(params: { owner: OwnerType; ownerId: string }): Promise<boolean>;
}
```

- [ ] **Step 2: Failing service test + mocks**

`family.service.mocks.ts`:

```ts
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FamilyService } from '@api/family/v1/family.service';
import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

// region Mocks

const userId = faker.string.uuid();
const familyResultMock = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  id: faker.string.uuid(),
  name: 'Example Family',
  ownerId: userId,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};
const familyApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  id: familyResultMock.id,
  name: 'Example Family',
  ownerId: userId,
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const createFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const deleteFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const findUserByIdUseCaseMock = {
  execute: jest
    .fn()
    .mockResolvedValue({ email: 'test@example.com', id: userId, name: 'Test User' }),
};
const getFamilyByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const getUserFamiliesUseCaseMock = { execute: jest.fn().mockResolvedValue([familyResultMock]) };
const updateFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const recordsCheckMock = { execute: jest.fn().mockResolvedValue(false) };

// endregion Mocks

let setup: FamilyService;

beforeEach(async () => {
  jest.clearAllMocks();
  recordsCheckMock.execute.mockResolvedValue(false);

  const module = await Test.createTestingModule({
    providers: [
      FamilyService,
      { provide: CreateFamilyUseCase, useValue: createFamilyUseCaseMock },
      { provide: DeleteFamilyUseCase, useValue: deleteFamilyUseCaseMock },
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: FindUserByIdUseCase, useValue: findUserByIdUseCaseMock },
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
      { provide: GetUserFamiliesUseCase, useValue: getUserFamiliesUseCaseMock },
      { provide: UpdateFamilyUseCase, useValue: updateFamilyUseCaseMock },
      { provide: FAMILY_OWNED_RECORDS_CHECKS, useValue: [recordsCheckMock] },
    ],
  }).compile();

  setup = module.get<FamilyService>(FamilyService);
});

const mocks = {
  createFamilyUseCase: createFamilyUseCaseMock,
  deleteFamilyUseCase: deleteFamilyUseCaseMock,
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyApi: familyApiMock,
  familyId: familyResultMock.id,
  findUserByIdUseCase: findUserByIdUseCaseMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  getUserFamiliesUseCase: getUserFamiliesUseCaseMock,
  recordsCheck: recordsCheckMock,
  updateFamilyUseCase: updateFamilyUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
```

`family.service.test.ts`:

```ts
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './family.service.mocks';

describe('create', () => {
  it('SHOULD look up the JWT user email AND create the family owned by the JWT user', async () => {
    const result = await setup.create(mocks.userId, { name: 'Example Family' });

    expect(mocks.findUserByIdUseCase.execute).toHaveBeenCalledWith({ id: mocks.userId });
    expect(mocks.createFamilyUseCase.execute).toHaveBeenCalledWith({
      name: 'Example Family',
      ownerEmail: 'test@example.com',
      ownerId: mocks.userId,
    });
    expect(result).toEqual(mocks.familyApi);
  });

  it('SHOULD ignore a client-supplied ownerId/userId in the body', async () => {
    const spoofed = { name: 'Example Family', ownerId: 'someone-else' } as { name: string };

    await setup.create(mocks.userId, spoofed);

    expect(mocks.createFamilyUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: mocks.userId }),
    );
  });

  it('SHOULD propagate NotFoundException WHEN the JWT user no longer exists AND create nothing', async () => {
    mocks.findUserByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.create(mocks.userId, { name: 'x' })).rejects.toThrow(NotFoundException);
    expect(mocks.createFamilyUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD return the user families with ISO dates AND only public fields', async () => {
    const result = await setup.findAll(mocks.userId);

    expect(mocks.getUserFamiliesUseCase.execute).toHaveBeenCalledWith({ userId: mocks.userId });
    expect(result).toEqual([mocks.familyApi]);
  });

  it('SHOULD return an empty array WHEN the user has no family', async () => {
    mocks.getUserFamiliesUseCase.execute.mockResolvedValueOnce([]);

    expect(await setup.findAll(mocks.userId)).toEqual([]);
  });
});

describe('findById', () => {
  it('SHOULD return the family', async () => {
    const result = await setup.findById(mocks.userId, mocks.familyId);

    expect(mocks.getFamilyByIdUseCase.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      userId: mocks.userId,
    });
    expect(result).toEqual(mocks.familyApi);
  });
});

describe('update', () => {
  it('SHOULD rename the family AND return it', async () => {
    const result = await setup.update(mocks.userId, mocks.familyId, { name: 'Renamed' });

    expect(mocks.updateFamilyUseCase.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      name: 'Renamed',
      userId: mocks.userId,
    });
    expect(result).toEqual(mocks.familyApi);
  });
});

describe('delete', () => {
  const ownerParams = { familyId: mocks.familyId, userId: mocks.userId };

  it('SHOULD verify the owner, run every records check AND then delete', async () => {
    await setup.delete(mocks.userId, mocks.familyId);

    expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith(ownerParams);
    expect(mocks.recordsCheck.execute).toHaveBeenCalledWith({
      owner: OwnerType.FAMILY,
      ownerId: mocks.familyId,
    });
    expect(mocks.deleteFamilyUseCase.execute).toHaveBeenCalledWith(ownerParams);
  });

  it('SHOULD throw ConflictException "Family still owns records" AND delete nothing WHEN a check returns true', async () => {
    mocks.recordsCheck.execute.mockResolvedValueOnce(true);

    const promise = setup.delete(mocks.userId, mocks.familyId);

    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toThrow('Family still owns records');
    expect(mocks.deleteFamilyUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD throw ForbiddenException (NOT Conflict) WHEN a non-owner member deletes a family that owns records', async () => {
    mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(new ForbiddenException());
    mocks.recordsCheck.execute.mockResolvedValue(true);

    await expect(setup.delete(mocks.userId, mocks.familyId)).rejects.toThrow(ForbiddenException);
    expect(mocks.recordsCheck.execute).not.toHaveBeenCalled();
    expect(mocks.deleteFamilyUseCase.execute).not.toHaveBeenCalled();
  });

  it('SHOULD throw NotFoundException BEFORE running any check WHEN the caller is not a member', async () => {
    mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.delete(mocks.userId, mocks.familyId)).rejects.toThrow(NotFoundException);
    expect(mocks.recordsCheck.execute).not.toHaveBeenCalled();
  });
});
```

(Note: when the family check list is empty the 409 branch is simply never taken — that is the shipped state; the spec's 409 acceptance criterion is covered by the mocked check above.)

- [ ] **Step 3: Run to verify it fails**

Run: `yarn jest src/api/family/v1/family.service`
Expected: FAIL — `Cannot find module '@api/family/v1/family.service'`.

- [ ] **Step 4: Implement the service**

`family.service.ts`:

```ts
import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { CreateFamilyInput, FamilyOutput, UpdateFamilyInput } from '@api/family/v1/dto/family.dto';
import {
  FAMILY_OWNED_RECORDS_CHECKS,
  IOwnedRecordsCheck,
} from '@api/family/v1/family-records-checks';
import { FamilyUseCaseOutput } from '@family/application/dto/FamilyUseCaseOutput';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

function toApiOutput(family: FamilyUseCaseOutput): FamilyOutput {
  return {
    createdAt: family.createdAt.toISOString(),
    id: family.id,
    name: family.name,
    ownerId: family.ownerId,
    updatedAt: family.updatedAt.toISOString(),
  };
}

@Injectable()
export class FamilyService {
  constructor(
    private readonly createFamilyUseCase: CreateFamilyUseCase,
    private readonly deleteFamilyUseCase: DeleteFamilyUseCase,
    private readonly ensureFamilyOwnerUseCase: EnsureFamilyOwnerUseCase,
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly getFamilyByIdUseCase: GetFamilyByIdUseCase,
    private readonly getUserFamiliesUseCase: GetUserFamiliesUseCase,
    private readonly updateFamilyUseCase: UpdateFamilyUseCase,
    @Inject(FAMILY_OWNED_RECORDS_CHECKS)
    private readonly ownedRecordsChecks: IOwnedRecordsCheck[],
  ) {}

  async create(userId: string, input: CreateFamilyInput): Promise<FamilyOutput> {
    // The family module cannot import the user module, so the owner email is resolved here.
    const user = await this.findUserByIdUseCase.execute({ id: userId });

    const family = await this.createFamilyUseCase.execute({
      name: input.name,
      ownerEmail: user.email,
      ownerId: userId,
    });

    return toApiOutput(family);
  }

  async delete(userId: string, familyId: string): Promise<void> {
    // 404 (non-member) -> 403 (non-owner) -> 409 (still owns records) -> delete.
    await this.ensureFamilyOwnerUseCase.execute({ familyId, userId });

    const results = await Promise.all(
      this.ownedRecordsChecks.map((check) =>
        check.execute({ owner: OwnerType.FAMILY, ownerId: familyId }),
      ),
    );

    if (results.some(Boolean)) {
      throw new ConflictException('Family still owns records');
    }

    await this.deleteFamilyUseCase.execute({ familyId, userId });
  }

  async findAll(userId: string): Promise<FamilyOutput[]> {
    const families = await this.getUserFamiliesUseCase.execute({ userId });

    return families.map((family) => toApiOutput(family));
  }

  async findById(userId: string, familyId: string): Promise<FamilyOutput> {
    const family = await this.getFamilyByIdUseCase.execute({ familyId, userId });

    return toApiOutput(family);
  }

  async update(userId: string, familyId: string, input: UpdateFamilyInput): Promise<FamilyOutput> {
    const family = await this.updateFamilyUseCase.execute({
      familyId,
      name: input.name,
      userId,
    });

    return toApiOutput(family);
  }
}
```

Run: `yarn jest src/api/family/v1/family.service` → PASS.

- [ ] **Step 5: Failing controller test + mocks**

`family.controller.mocks.ts`:

```ts
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FamilyController } from '@api/family/v1/family.controller';
import { FamilyService } from '@api/family/v1/family.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const familyApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  id: faker.string.uuid(),
  name: 'Example Family',
  ownerId: userId,
  updatedAt: '2026-10-04T12:00:00.000Z',
};

const requestMock = { user: { id: userId } } as JwtPayload & Request;

const familyServiceMock = {
  create: jest.fn().mockResolvedValue(familyApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([familyApiMock]),
  findById: jest.fn().mockResolvedValue(familyApiMock),
  update: jest.fn().mockResolvedValue(familyApiMock),
};

// endregion Mocks

let setup: FamilyController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [FamilyController],
    providers: [{ provide: FamilyService, useValue: familyServiceMock }],
  }).compile();

  setup = module.get<FamilyController>(FamilyController);
});

const mocks = { family: familyApiMock, familyService: familyServiceMock, request: requestMock };
const spies = {};

export { mocks, setup, spies };
```

`family.controller.test.ts`:

```ts
import { HTTP_CODE_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './family.controller.mocks';

it('SHOULD be served under URI version 1', () => {
  expect(Reflect.getMetadata(VERSION_METADATA, setup.constructor)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD list the families of the JWT user', async () => {
    const result = await setup.findAll(mocks.request);

    expect(mocks.familyService.findAll).toHaveBeenCalledWith(mocks.request.user.id);
    expect(result).toEqual([mocks.family]);
  });
});

describe('create', () => {
  it('SHOULD create the family for the JWT user with the trimmed name', async () => {
    const result = await setup.create(mocks.request, { name: '  Example Family ' });

    expect(mocks.familyService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      name: 'Example Family',
    });
    expect(result).toEqual(mocks.family);
  });

  it('SHOULD drop client-supplied ownerId/userId so they never reach the service', async () => {
    const body = { name: 'Example Family', ownerId: 'someone-else', userId: 'someone-else' };

    await setup.create(mocks.request, body);

    expect(mocks.familyService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      name: 'Example Family',
    });
  });

  it.each([
    ['missing body', undefined],
    ['missing name', {}],
    ['empty name', { name: '' }],
    ['whitespace-only name', { name: '   ' }],
    ['51-character name', { name: 'a'.repeat(51) }],
    ['null name', { name: null }],
    ['numeric name', { name: 123 }],
  ])('SHOULD throw ValidationError (400) WHEN %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never)).rejects.toThrow(ValidationError);
    expect(mocks.familyService.create).not.toHaveBeenCalled();
  });
});

describe('findById', () => {
  it('SHOULD return the family for the JWT user', async () => {
    const result = await setup.findById(mocks.request, mocks.family.id);

    expect(mocks.familyService.findById).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.family.id,
    );
    expect(result).toEqual(mocks.family);
  });
});

describe('update', () => {
  it('SHOULD rename the family (only the name) for the JWT user', async () => {
    const result = await setup.update(mocks.request, mocks.family.id, {
      name: 'Renamed',
      ownerId: 'someone-else',
    } as { name: string });

    expect(mocks.familyService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.family.id,
      { name: 'Renamed' },
    );
    expect(result).toEqual(mocks.family);
  });

  it('SHOULD throw ValidationError (400) WHEN the name is blank', async () => {
    await expect(setup.update(mocks.request, mocks.family.id, { name: ' ' })).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.familyService.update).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('SHOULD delete the family for the JWT user AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.family.id);

    expect(mocks.familyService.delete).toHaveBeenCalledWith(mocks.request.user.id, mocks.family.id);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, setup.delete)).toBe(204);
  });
});
```

- [ ] **Step 6: Run to verify it fails, then implement the controller**

Run: `yarn jest src/api/family/v1/family.controller` → FAIL (`Cannot find module '@api/family/v1/family.controller'`).

`family.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  CreateFamilyApiSchema,
  CreateFamilyInput,
  FamilyOutput,
  UpdateFamilyApiSchema,
  UpdateFamilyInput,
} from '@api/family/v1/dto/family.dto';
import { FamilyService } from '@api/family/v1/family.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

@ApiBearerAuth('JWT')
@Controller({
  path: 'families',
  version: '1',
})
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @ZodResponse({ status: 201, type: FamilyOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateFamilyInput) {
    const input = validate(CreateFamilyApiSchema, body);

    return this.familyService.create(req.user.id, input);
  }

  @Delete(':familyId')
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    await this.familyService.delete(req.user.id, familyId);
  }

  @Get()
  @ZodResponse({ status: 200, type: [FamilyOutput] })
  async findAll(@Request() req: JwtPayload & Request) {
    return this.familyService.findAll(req.user.id);
  }

  @Get(':familyId')
  @ZodResponse({ status: 200, type: FamilyOutput })
  async findById(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    return this.familyService.findById(req.user.id, familyId);
  }

  @Patch(':familyId')
  @ZodResponse({ status: 200, type: FamilyOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() body: UpdateFamilyInput,
  ) {
    const input = validate(UpdateFamilyApiSchema, body);

    return this.familyService.update(req.user.id, familyId, input);
  }
}
```

Run: `yarn jest src/api/family` → PASS. (If `ZodResponse` rejects the array form `[FamilyOutput]` at type-check, use `createZodDto(z.array(FamilyApiSchema))` as a `FamilyListOutput` class instead — nestjs-zod 5.0.1 documents the array form, so this is only a fallback.)

- [ ] **Step 7: API module and registration**

`src/api/family/family.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { FamilyController } from '@api/family/v1/family.controller';
import { FamilyService } from '@api/family/v1/family.service';
import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { FamilyModule } from '@family/family.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [FamilyController],
  imports: [FamilyModule, UserModule],
  providers: [
    FamilyService,
    {
      // Specs 005/006: import their modules above and replace `useValue: []` with
      // `useFactory: (...checks) => checks, inject: [<HasStockByOwnerUseCase>, HasFinanceDataByOwnerUseCase]`.
      provide: FAMILY_OWNED_RECORDS_CHECKS,
      useValue: [],
    },
  ],
})
export class FamilyAPIModule {}
```

`src/api/api.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';
import { FamilyAPIModule } from '@api/family/family.module';
import { UserAPIModule } from '@api/user/user.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, AuthAPIModule, FamilyAPIModule, UserAPIModule],
})
export class ApiModule {}
```

- [ ] **Step 8: Verify and commit**

Run: `yarn type-check && yarn jest src/api src/modules/family`
Expected: PASS.

```bash
git add src/api
git commit -m "feat(api): add /api/v1/families endpoints" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**

- Modify: `.claude/context/api.md`, `.claude/context/integration.md`, `.claude/context/database.md`, `.claude/context/domain.md`, `.claude/context/application.md`, `.claude/CLAUDE.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: `api.md`** — add to the "Existing endpoints" table:

| Method | Path                         | Auth | Notes                                                                                                                                                                                               |
| ------ | ---------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/families`           | JWT  | families the user belongs to (joined memberships), sorted by name (case-insensitive) then `createdAt`; `[]` if none                                                                                 |
| POST   | `/api/v1/families`           | JWT  | `{ name }` (trimmed, 1–50) → `201 FamilyOutput`; creates family + owner membership atomically; `400` invalid name                                                                                   |
| GET    | `/api/v1/families/:familyId` | JWT  | `200 FamilyOutput`; `400` bad UUID; `404` unknown or non-member                                                                                                                                     |
| PATCH  | `/api/v1/families/:familyId` | JWT  | `{ name }` → `200 FamilyOutput`; owner only: `403` member non-owner, `404` non-member                                                                                                               |
| DELETE | `/api/v1/families/:familyId` | JWT  | `204`; owner only; order `404 → 403 → 409`; `409 "Family still owns records"` when any registered owned-records check is true (list is in `FAMILY_OWNED_RECORDS_CHECKS`, empty until specs 005/006) |

Also add one paragraph describing `FAMILY_OWNED_RECORDS_CHECKS` (where it lives, the `IOwnedRecordsCheck` contract, "specs 005/006 register their module-level use case in `FamilyAPIModule`").

- [ ] **Step 2: `integration.md`** — Family row: backend state `implemented (/api/v1/families)`; note `family_name` → `name`, `createdAt/updatedAt` added; Family member row stays `domain only (base table created by spec 003; features in spec 004)`. Add under "Cross-repo change checklist" a bullet that the frontend must stop creating the owner member itself (the API does it) and map 409 to `FamilyHasRecords` — listing the frontend plan.

- [ ] **Step 3: `database.md`** — replace the "Current models" and migrations lines: models `User`, `Family` (`families`), `FamilyMember` (`family_members`, base columns only; spec 004 may add columns in its own migration but must not redefine these); migrations are now committed (`20261004000000_baseline_user`, `20261004000100_family`); add the warning: _a database that already has `"User"` (created by `db push`) must run `yarn prisma migrate resolve --applied 20261004000000_baseline_user` once before `migrate deploy`/`yarn start`_; document ids/FKs are `text` UUID strings because `User.id` is `text`.

- [ ] **Step 4: `domain.md`** — in "Repository interfaces", change the "Existing contracts that still need an implementation" sentence: remove `FamilyRepository` from the list (now `IFamilyRepository`, implemented), keep `FamilyMemberRepository`, `FinanceTransactionRepository`, `StockRepository`.

- [ ] **Step 5: `application.md`** — add "Family module use cases": the 8 use cases with one line each, plus the exported cross-module contract (`GetUserFamilyIdsUseCase.execute(userId) → string[]`, `CheckFamilyMembershipUseCase.execute({ userId, familyId }) → boolean`, composed only in `src/api`).

- [ ] **Step 6: `.claude/CLAUDE.md` "Current state"** — Implemented end-to-end: add `family` (families CRUD API; members/invites are spec 004). Domain-only list: remove `family (Family…)` → leave `family` member entity `FamilyMember` only. Prisma line: `User`, `Family`, `FamilyMember`; migrations committed. Update the golden-rule-free "Prisma schema has only the User model" sentence.

- [ ] **Step 7: Commit**

```bash
git add .claude/CLAUDE.md .claude/context/api.md .claude/context/integration.md .claude/context/database.md .claude/context/domain.md .claude/context/application.md
git diff --cached --stat
git commit -m "docs: document families API, models and migrations" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Whole-suite verification and real-DB smoke test

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Full quality gates**

```bash
yarn type-check && yarn lint && yarn prettier && yarn test --coverage
```

Expected: all pass; global coverage ≥ 90% on all four metrics. Fix whatever fails (do not bypass hooks).

- [ ] **Step 2: Start the API against the throwaway DB**

```bash
DB_USER=postgres DB_PASSWORD=pg DB_HOST=localhost DB_PORT=55432 DB_NAME=lp PORT=3030 yarn start
```

(`prestart` runs `prisma migrate deploy` against the throwaway DB — expected "No pending migrations" or both applied.) Leave it running in another terminal/background.

- [ ] **Step 3: Walk the acceptance criteria with curl** (`B=http://localhost:3030/api/v1`; fake emails only)

```bash
# two users A and B
curl -s -X POST $B/auth/signup/email -H 'content-type: application/json' -d '{"email":"a@example.com","name":"A","password":"password-a-123"}'
curl -s -X POST $B/auth/signup/email -H 'content-type: application/json' -d '{"email":"b@example.com","name":"B","password":"password-b-123"}'
TA=$(curl -s -X POST $B/auth/login/email -H 'content-type: application/json' -d '{"email":"a@example.com","password":"password-a-123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
TB=$(curl -s -X POST $B/auth/login/email -H 'content-type: application/json' -d '{"email":"b@example.com","password":"password-b-123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
```

Then, and compare with the expected status/body (use `curl -s -o /dev/stderr -w '%{http_code}\n' …`):

| Call                                                                                | Expected                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET $B/families` as A                                                              | `200 []`                                               |
| `POST $B/families` as A, `{"name":"  Smith Family "}`                               | `201`, `name` = `Smith Family`, `ownerId` = A's id     |
| `POST` with `{}`, `{"name":"   "}`, 51 chars, and `{"name":"X","ownerId":"<B id>"}` | `400`, `400`, `400`, `201` with `ownerId` = **A's** id |
| `GET $B/families` as A after creating "banana" and "Apple"                          | order `Apple`, `banana`, `Smith Family`                |
| `GET $B/families/<id>` as B                                                         | `404`                                                  |
| `GET $B/families/not-a-uuid` as A                                                   | `400`; with no `Authorization` header → `401`          |
| `PATCH $B/families/<id>` as A, `{"name":"Renamed"}`                                 | `200`, `updatedAt` changed                             |
| `PATCH` / `DELETE` as B (non-member)                                                | `404`                                                  |

- [ ] **Step 4: Member-vs-pending and cascade checks directly in SQL** (spec 004 owns invites, so insert rows by hand)

```bash
docker exec lp-pg-003 psql -U postgres -d lp -c "SELECT id,email FROM \"User\";"   # note A_ID and B_ID
# B pending (user_id set, joined_at NULL)
docker exec lp-pg-003 psql -U postgres -d lp -c "INSERT INTO family_members(id,family_id,email,user_id,updated_at) VALUES (gen_random_uuid()::text,'<FAMILY_ID>','b@example.com','<B_ID>',now());"
```

Expected via curl as B: `GET $B/families` → does **not** contain `<FAMILY_ID>`; `GET $B/families/<FAMILY_ID>` → `404`. Then join B:
`UPDATE family_members SET joined_at=now() WHERE family_id='<FAMILY_ID>' AND user_id='<B_ID>';` → as B: `GET` → `200`, `PATCH` → `403`, `DELETE` → `403`.
Finally as A: `DELETE $B/families/<FAMILY_ID>` → `204`; `SELECT count(*) FROM family_members WHERE family_id='<FAMILY_ID>'` → `0`; a second `DELETE` as A → `404`.

- [ ] **Step 5: Clean up**

Stop the API (Ctrl-C / kill the background process) and `docker rm -f lp-pg-003`. Do not commit anything from this task. Confirm `git status --short` shows no stray files.

- [ ] **Step 6: Final report** — list the changed backend files (`git diff --stat origin/main...HEAD`), note the frontend files that must change (see the frontend plan) and repeat the **existing-DB baseline** warning (Decision 3) to the owner. Do not edit `../life-planner` from this plan.

---

## Self-review (spec coverage)

- §4/§5.1–5.7 rules → Tasks 3 (membership filter), 4 (404 non-member, sort), 5 (name, owner chain), 6 (JWT-only user, 409 ordering).
- §5.3 atomic create + owner membership (`email` = user email, `joined_at` now, `invite_token` null) → Task 3 nested create (token column omitted → null) + Task 6 email lookup; the "membership insert fails → nothing persisted" criterion is guaranteed by the single nested write and unit-tested as error propagation (Task 3); real-DB confirmation in Task 8.
- §5.7 extensible 409 composition point → Task 6 token + service; empty today by design (Decision 8).
- §5.8 exported contract + unit tests (joined true, pending false, non-member false) → Task 4 (use case level) and Task 3 (datasource filter assertion).
- §5.9 `I` prefix, reshaped interface → Task 2.
- §5.10 no extra user fields → Task 6 `toApiOutput`.
- §6 tables/FKs/uniques/indexes/cascades → Task 1 (incl. DB-level cascade check).
- §7 endpoints and status codes → Task 6; docs → Task 7. §12 backend docs → Task 7. (Product pack `02–07` is handled in the frontend plan's last task.)
- §11 no logging of names/emails: no logging added anywhere in the plan.
- Frontend items are intentionally in the other plan.
