import { StockForecastGate } from './index';

function gate(ttl: number, clock: () => number = () => 1000) {
  return new StockForecastGate({ stockForecastGateTtlMs: ttl } as never, clock);
}
function noop() {
  // resolves nothing
}

it('SHOULD skip the task for an owner already refreshed that day inside the TTL', async () => {
  const setup = gate(60000);
  const task = jest.fn().mockResolvedValue(undefined);

  await setup.runOnce(['USER:u'], '2026-11-25', task);
  await setup.runOnce(['USER:u'], '2026-11-25', task);

  expect(task).toHaveBeenCalledTimes(1);
});

it('SHOULD run again WHEN the day changes OR the TTL expires', async () => {
  let now = 1000;
  const setup = gate(60000, () => now);
  const task = jest.fn().mockResolvedValue(undefined);

  await setup.runOnce(['USER:u'], '2026-11-25', task);
  await setup.runOnce(['USER:u'], '2026-11-26', task);
  now += 61000;
  await setup.runOnce(['USER:u'], '2026-11-26', task);

  expect(task).toHaveBeenCalledTimes(3);
});

it('SHOULD always run WHEN the TTL is 0', async () => {
  const setup = gate(0);
  const task = jest.fn().mockResolvedValue(undefined);

  await setup.runOnce(['USER:u'], '2026-11-25', task);
  await setup.runOnce(['USER:u'], '2026-11-25', task);

  expect(task).toHaveBeenCalledTimes(2);
});

it('SHOULD share one run between concurrent reads AND mark nothing when it fails', async () => {
  const setup = gate(60000);
  let release = noop;
  const task = jest.fn().mockImplementation(
    async () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = setup.runOnce(['USER:u'], '2026-11-25', task);
  const second = setup.runOnce(['USER:u'], '2026-11-25', task);

  release();
  await Promise.all([first, second]);

  expect(task).toHaveBeenCalledTimes(1);

  const failing = gate(60000);
  const broken = jest.fn().mockRejectedValue(new Error('boom'));

  await expect(failing.runOnce(['USER:u'], '2026-11-25', broken)).rejects.toThrow('boom');
  await expect(failing.runOnce(['USER:u'], '2026-11-25', broken)).rejects.toThrow('boom');
  expect(broken).toHaveBeenCalledTimes(2);
});
