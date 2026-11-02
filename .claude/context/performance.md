# Performance guardrail (backend)

Rule: `.claude/CLAUDE.md` rule 17. Specs: 065 (query counts), 066 (timing, payload, concurrency, EXPLAIN), 068 (rules).

## Commands

- `yarn perf --changed`: modules touched by the diff (against `origin/main`, plus uncommitted and untracked files). `src/shared/`, `prisma/`, `package.json` and `yarn.lock` select every module.
- `yarn perf --all`, `yarn perf --module <family|finance|health|stock|user|version>`, `--dry-run` (shows the selection only).
- `yarn perf --module <m> --update-baseline`: writes the measured numbers into the budgets (the ratchet, see below).
- `yarn perf:check` runs only the timing, payload, concurrency and EXPLAIN part (`scripts/perf/check/*`).
- `yarn perf:seed` fills the local perf data set (`perf/seed.config.json`); `yarn perf` seeds what is missing or stale on its own.
- Exit codes: `0` passed, `1` a budget failed, `2` could not run (guard refused the environment, seed or build failed). On `2`, report its one-line reason and never claim the change was checked.

## Reading the result

Read only `perf-report/summary.md` (git-ignored). It ends with `PERF PASSED: N/N` or `PERF FAILED: N/N` and lists each failure with its module and route. Open other files in `perf-report/` only for a failure named there.

## Registry

`perf/budgets/<module>.json`, one entry per route, key `METHOD /path` (optionally `#scenario` suffix):

| Field                                  | Meaning                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `kind`                                 | `read`, `write` (needs `recipe`) or `unmeasured` (needs `reason`)                                  |
| `scenario`                             | name of the seeded scenario the measurement uses                                                   |
| `maxQueries`                           | max Prisma queries for one request                                                                 |
| `maxBytes`, `p50Ms`                    | payload and median latency budgets (`null` when not measured)                                      |
| `indexes`, `table`, `seqScanException` | expected indexes for EXPLAIN; a sequential scan needs a justification                              |
| `knownException`                       | a budget above the default limit (for example a list over 256 KB), naming the spec that removes it |

A route without an entry fails `yarn test` (`scripts/perf/registry.coverage.test.ts`): add the entry in the same PR as the route, then `yarn perf --module <m> --update-baseline`.

## Ratchet and exceptions

- `--update-baseline` only lowers a budget silently. Raising one needs a reason in the PR description and the owner's review.
- A `knownException` or `seqScanException` always names the spec that removes it.
- Lists have a period or pagination. Money data is never cached with `max-age`; use `private, no-cache` plus validation.

## PR block

Copy into the PR description (template: `.github/pull_request_template.md`): modules checked, the final summary line, and before/after of any changed budget.
