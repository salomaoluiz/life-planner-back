import { EnvService } from '@shared/infra/env/env.service';

import { MaterializationGate } from './index';

export const TODAY = '2026-11-04';
export const NEXT_MONTH_DAY = '2026-12-01';
export const UNTIL = '2026-11-30';

export function buildGate(ttlMs = 60000) {
  const clock = { now: 1_000_000 };
  const env = { financeMaterializationGateTtlMs: ttlMs } as unknown as EnvService;

  return { clock, gate: new MaterializationGate(env, () => clock.now) };
}

// A task that stays pending until `release` is called.
export function deferredTask() {
  let release!: () => void;
  let fail!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  const task = jest.fn(async () => promise);

  return { fail, release, task };
}
