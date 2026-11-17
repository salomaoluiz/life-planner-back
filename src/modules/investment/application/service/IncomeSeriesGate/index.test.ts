import { IncomeSeriesGate } from './index';

function noop(): void {
  return undefined;
}

let now = 1_000_000;
const env = { financeMaterializationGateTtlMs: 60000 };

function gate(ttl = 60000): IncomeSeriesGate {
  env.financeMaterializationGateTtlMs = ttl;

  return new IncomeSeriesGate(env as never, () => now);
}

beforeEach(() => {
  now = 1_000_000;
});

it('SHOULD run the first time AND skip inside the TTL of the same month (spec 115 FR 18)', async () => {
  const instance = gate();
  const task = jest.fn().mockResolvedValue(undefined);

  await instance.runOnce(['u1'], '2026-11-12', task);
  await instance.runOnce(['u1'], '2026-11-20', task);

  expect(task).toHaveBeenCalledTimes(1);
});

it('SHOULD run again after the TTL, in another month, for another owner OR after an invalidate', async () => {
  const instance = gate();
  const task = jest.fn().mockResolvedValue(undefined);

  await instance.runOnce(['u1'], '2026-11-12', task);
  now += 60001;
  await instance.runOnce(['u1'], '2026-11-12', task);
  await instance.runOnce(['u1'], '2026-12-01', task);
  await instance.runOnce(['u2'], '2026-12-01', task);
  instance.invalidate(['u2']);
  await instance.runOnce(['u2'], '2026-12-01', task);

  expect(task).toHaveBeenCalledTimes(5);
});

it('SHOULD share one in-flight run between concurrent reads', async () => {
  const instance = gate();
  let release: () => void = noop;
  const task = jest.fn(
    async () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = instance.runOnce(['u1'], '2026-11-12', task);
  const second = instance.runOnce(['u1'], '2026-11-12', task);

  release();
  await Promise.all([first, second]);

  expect(task).toHaveBeenCalledTimes(1);
});

it('SHOULD always run WHEN the TTL is 0', async () => {
  const instance = gate(0);
  const task = jest.fn().mockResolvedValue(undefined);

  await instance.runOnce(['u1'], '2026-11-12', task);
  await instance.runOnce(['u1'], '2026-11-12', task);

  expect(task).toHaveBeenCalledTimes(2);
});
