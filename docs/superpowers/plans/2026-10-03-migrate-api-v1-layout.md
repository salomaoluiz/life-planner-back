# Migrate legacy `api/v1/<name>` to `api/<name>/v1` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the legacy `src/api/v1/{auth,user}` code to the new `src/api/<name>/v1/` layout without changing any public URL.

**Architecture:** Each resource gets its own `src/api/<name>/<name>.module.ts` plus a `v1/` folder holding controller, service, DTOs, tests and mocks. Controllers declare `version: '1'` themselves instead of inheriting it from `RouterModule`; `V1Module` is deleted and `ApiModule` imports the two API modules directly.

**Tech Stack:** NestJS 10 (URI versioning), TypeScript strict, Zod 4 + nestjs-zod, Jest, ESLint/Prettier, Husky.

**Spec:** `.claude/context/api.md` (section "Folder & versioning convention", the "Legacy layout" bullet) and `.claude/context/integration.md` (auth contract, endpoint URLs). No separate design doc. No branch is created (user instruction); work on the current branch `user-module`.

## Global Constraints

- Public URLs must not change: `POST /api/v1/auth/login/email`, `POST /api/v1/auth/signup/email`, `GET /api/v1/user/me`, `GET|PATCH /api/v1/user/:id`.
- "When migrating, move files, drop the `RouterModule` entry, add `version: '1'` to the controller, import the module in `ApiModule`, and update aliases/imports/tests."
- "Don't mix both layouts for the same resource."
- Path aliases only (`@api/*`, never `../../`); relative `./` imports are only for same-folder files.
- No `any`, `@ts-ignore`, or lint-disable.
- Behavior is unchanged: the known gap (no ownership check on `GET/PATCH /v1/user/:id`) is out of scope; do not fix or copy it silently.
- Conventional commits; never `--no-verify`; stage files explicitly (no `git add -A` / `.`). End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Test coverage threshold stays at 90% global.

## Review Focus

- Controller without `version: '1'` → route silently becomes `/api/auth/...` (404 for the app). Pinned by a metadata test per controller (Tasks 1, 2).
- `RouterModule` entry left behind or double registration → duplicate or wrong routes. Pinned by Task 3 grep + boot check.
- Stale `@api/v1/<name>/...` imports or `jest.mock('@api/v1/...')` paths in `*.mocks.ts` → tests fail or mock the wrong module. Pinned by Task 1/2 grep for `@api/v1/` returning nothing.
- `dist/` and `coverage/` contain old paths → ignore them, do not edit (build artifacts).
- Docs still describing the legacy layout mislead the next feature. Pinned by Task 3 doc grep.

## File Structure

Target (moves done with `git mv` to keep history):

```
src/api/
├── api.module.ts                       # imports HealthModule, AuthAPIModule, UserAPIModule
├── auth/
│   ├── auth.module.ts                  # AuthAPIModule (was api/v1/auth/auth.module.ts)
│   └── v1/
│       ├── auth.controller.ts (+ .test.ts, .mocks.ts)
│       ├── auth.service.ts    (+ .test.ts, .mocks.ts)
│       └── dto/{login,signup}.dto.ts
└── user/
    ├── user.module.ts                  # UserAPIModule
    └── v1/
        ├── user.controller.ts (+ .test.ts, .mocks.ts)
        ├── user.service.ts    (+ .test.ts, .mocks.ts)
        └── dto/{find-user-by-id,update-user}.dto.ts
```

`src/api/v1/v1.module.ts` is deleted in Task 3.

---

### Task 1: Migrate `auth`

**Files:**

- Move: `src/api/v1/auth/auth.module.ts` → `src/api/auth/auth.module.ts`
- Move: `src/api/v1/auth/{auth.controller,auth.service}{.ts,.test.ts,.mocks.ts}` and `src/api/v1/auth/dto/*` → `src/api/auth/v1/`
- Modify: `src/api/auth/auth.module.ts`, `src/api/auth/v1/auth.controller.ts`, `auth.service.ts`, `auth.controller.mocks.ts`
- Test: `src/api/auth/v1/auth.controller.test.ts`

**Interfaces:**

- Consumes: `UserModule` from `@user/user.module` (unchanged).
- Produces: `AuthAPIModule` exported from `@api/auth/auth.module` (same class name; Task 3 imports it). DTO import path becomes `@api/auth/v1/dto/login.dto` and `@api/auth/v1/dto/signup.dto`.

- [ ] **Step 1: Move the files**

```bash
cd /Users/salomao-neto/Documents/Develop/personal/Life_Planner/repo/life-planner-back
mkdir -p src/api/auth/v1
git mv src/api/v1/auth/auth.module.ts src/api/auth/auth.module.ts
git mv src/api/v1/auth/dto src/api/auth/v1/dto
for f in src/api/v1/auth/auth.*; do git mv "$f" src/api/auth/v1/; done
rmdir src/api/v1/auth
```

- [ ] **Step 2: Fix imports** (replace every `@api/v1/auth/` with `@api/auth/v1/`)

```bash
grep -rl "@api/v1/auth/" src | xargs sed -i '' 's#@api/v1/auth/#@api/auth/v1/#g'
grep -rn "@api/v1/auth" src   # expected: no output
```

In `src/api/auth/auth.module.ts` the controller/service now live in `v1/`, so replace the two relative imports with aliases:

```ts
import { Module } from '@nestjs/common';

import { AuthController } from '@api/auth/v1/auth.controller';
import { AuthService } from '@api/auth/v1/auth.service';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [AuthController],
  imports: [UserModule],
  providers: [AuthService],
})
export class AuthAPIModule {}
```

- [ ] **Step 3: Write the failing version test.** Append to `src/api/auth/v1/auth.controller.test.ts` (inside its top-level `describe`; add `import { VERSION_METADATA } from '@nestjs/common/constants';` to the import group with other external imports, and `import { AuthController } from './auth.controller';` to the relative group if not already present):

```ts
it('is served under URI version 1', () => {
  expect(Reflect.getMetadata(VERSION_METADATA, AuthController)).toBe('1');
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `yarn jest src/api/auth/v1/auth.controller.test.ts -t "URI version 1"`
Expected: FAIL (`Expected: "1", Received: undefined`)

- [ ] **Step 5: Declare the version.** In `src/api/auth/v1/auth.controller.ts` change `@Controller('auth')` to:

```ts
@Controller({ path: 'auth', version: '1' })
```

- [ ] **Step 6: Run the auth tests, type-check, lint**

Run: `yarn jest src/api/auth && yarn type-check && yarn eslint "src/api/auth/**/*.ts"`
Expected: all PASS, no lint errors (fix import-order complaints with `yarn eslint --fix`).

(`type-check` and the user folder still compile because `v1.module.ts` is patched in Step 7.)

- [ ] **Step 7: Re-register `auth` so the commit stays correct.** A controller with `version: '1'` plus the legacy `RouterModule` `v1` prefix would serve `/api/v1/v1/auth`, so remove auth from the legacy router in this same task.

In `src/api/v1/v1.module.ts`: remove the `AuthAPIModule` import, its entry in `imports`, and its `{ module: AuthAPIModule, path: 'v1' }` entry in `RouterModule.register`.
Then `src/api/api.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';

import { HealthModule } from './health/health.module';
import { V1Module } from './v1/v1.module';

@Module({
  imports: [HealthModule, AuthAPIModule, V1Module],
})
export class ApiModule {}
```

Run: `yarn type-check && yarn jest src/api`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/api
git commit -m "refactor(api): migrate auth to api/auth/v1 layout"
```

---

### Task 2: Migrate `user`

**Files:**

- Move: `src/api/v1/user/user.module.ts` → `src/api/user/user.module.ts`
- Move: `src/api/v1/user/{user.controller,user.service}{.ts,.test.ts,.mocks.ts}` and `src/api/v1/user/dto/*` → `src/api/user/v1/`
- Modify: `src/api/user/user.module.ts`, `src/api/user/v1/user.controller.ts`, `user.service.ts`, `user.service.mocks.ts`, `src/api/api.module.ts`, `src/api/v1/v1.module.ts`
- Test: `src/api/user/v1/user.controller.test.ts`

**Interfaces:**

- Consumes: `UserModule` from `@user/user.module`.
- Produces: `UserAPIModule` exported from `@api/user/user.module`; DTO paths `@api/user/v1/dto/find-user-by-id.dto`, `@api/user/v1/dto/update-user.dto`.

- [ ] **Step 1: Move the files**

```bash
mkdir -p src/api/user/v1
git mv src/api/v1/user/user.module.ts src/api/user/user.module.ts
git mv src/api/v1/user/dto src/api/user/v1/dto
for f in src/api/v1/user/user.*; do git mv "$f" src/api/user/v1/; done
rmdir src/api/v1/user
```

- [ ] **Step 2: Fix imports**

```bash
grep -rl "@api/v1/user/" src | xargs sed -i '' 's#@api/v1/user/#@api/user/v1/#g'
grep -rn "@api/v1/user" src   # expected: no output
```

Rewrite `src/api/user/user.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { UserController } from '@api/user/v1/user.controller';
import { UserService } from '@api/user/v1/user.service';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [UserController],
  imports: [UserModule],
  providers: [UserService],
})
export class UserAPIModule {}
```

- [ ] **Step 3: Write the failing version test.** Append to `src/api/user/v1/user.controller.test.ts` (inside the top-level `describe`; add `import { VERSION_METADATA } from '@nestjs/common/constants';` and `import { UserController } from './user.controller';` to the matching import groups):

```ts
it('is served under URI version 1', () => {
  expect(Reflect.getMetadata(VERSION_METADATA, UserController)).toBe('1');
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `yarn jest src/api/user/v1/user.controller.test.ts -t "URI version 1"`
Expected: FAIL (`Received: undefined`)

- [ ] **Step 5: Declare the version.** In `src/api/user/v1/user.controller.ts`:

```ts
@Controller({
  path: 'user',
  version: '1',
})
```

- [ ] **Step 6: Wire into `ApiModule` and drop the legacy router.** `src/api/api.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';
import { UserAPIModule } from '@api/user/user.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, AuthAPIModule, UserAPIModule],
})
export class ApiModule {}
```

Delete the now-empty legacy module and folder:

```bash
git rm src/api/v1/v1.module.ts
ls src/api/v1 2>/dev/null   # expected: directory gone / empty
```

- [ ] **Step 7: Run tests, type-check, lint**

Run: `yarn jest src/api && yarn type-check && yarn eslint "src/api/**/*.ts"`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/api
git commit -m "refactor(api): migrate user to api/user/v1 and remove legacy V1Module"
```

---

### Task 3: Verify routes and update docs

**Files:**

- Modify: `.claude/context/api.md`, `.claude/context/architecture.md`, `.claude/context/conventions.md`, `.claude/context/integration.md`, `.claude/context/application.md`, `.claude/skills/new-feature-slice/SKILL.md`, `.github/copilot-instructions.md`, `.claude/CLAUDE.md`

**Interfaces:**

- Consumes: Tasks 1–2 results (`AuthAPIModule`, `UserAPIModule` in `ApiModule`, no `V1Module`).
- Produces: docs describing a single layout.

- [ ] **Step 1: Confirm no legacy references remain in source**

Run: `grep -rnE "@api/v1|V1Module|RouterModule|v1\.module" src`
Expected: no output.

- [ ] **Step 2: Boot check of the real routes.** Requires a local `.env` (DB\_\*, JWT_SECRET); skip and say so if unavailable.

Run: `yarn start:dev 2>&1 | grep -E "Mapped \{"` (stop with Ctrl-C after startup)
Expected exactly these mapped routes: `/api/v1/auth/login/email, POST`, `/api/v1/auth/signup/email, POST`, `/api/v1/user/me, GET`, `/api/v1/user/:id, GET`, `/api/v1/user/:id, PATCH`, and `/api/health, GET`. Anything under `/api/v1/v1/` or `/api/auth` is a bug.

- [ ] **Step 3: Update docs.** Make these edits:
  - `api.md` line 14: replace the "Legacy layout" bullet with a note that all resources (`auth`, `user`) now use `api/<name>/v1/`; delete line 27 ("Legacy …keeps controller…"); in line 29 remove the legacy parenthetical; in line 32 remove "Legacy layout only → `v1.module.ts`…".
  - `architecture.md`: tree (lines ~7-13) → `api.module.ts # imports HealthModule + auth/user API modules`, replace the `v1/ # LEGACY` block with `auth/ user/ # api/<name>/<name>.module.ts + v1/`; line ~54 drop the legacy sentence; line ~75 drop "(legacy: …)".
  - `conventions.md` line 17: `API: src/api/<name>/v<N>`.
  - `integration.md` line 24: `user` + `api/auth/v1`, `api/user/v1`.
  - `application.md` line 32: drop "; legacy `src/api/v1/**/dto`".
  - `SKILL.md` line 8: `src/api/user/v1`.
  - `.github/copilot-instructions.md` line ~24: remove the legacy `v1/` line and show `auth/`, `user/`.
  - `.claude/CLAUDE.md`: no change needed unless it mentions legacy layout (it does not); leave as is.

- [ ] **Step 4: Verify docs are clean**

Run: `grep -rniE "legacy" .claude .github | grep -iE "layout|api/v1|v1\.module|RouterModule"`
Expected: no output (the "Supabase legacy backend" mentions in `integration.md`/`CLAUDE.md` are unrelated and stay).

- [ ] **Step 5: Full verification**

Run: `yarn lint && yarn type-check && yarn test --coverage`
Expected: all PASS, coverage ≥ 90%.

- [ ] **Step 6: Commit**

```bash
git add .claude .github
git commit -m "docs: describe single api/<name>/v1 layout after migration"
```

## Self-Review

- Spec coverage: move files, drop `RouterModule`, add `version: '1'`, import in `ApiModule`, update aliases/imports/tests, URLs unchanged → Tasks 1–3. Docs/endpoint table: URLs unchanged, so the table in `api.md` needs no edit.
- Placeholders: none.
- Consistency: `AuthAPIModule` / `UserAPIModule` names and alias paths match across tasks.
- No contract change, so no frontend work (`integration.md` checklist does not apply).
