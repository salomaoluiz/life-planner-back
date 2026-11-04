import { buildGate, deferredTask, NEXT_MONTH_DAY, TODAY } from './index.mocks';

function run(gate: ReturnType<typeof buildGate>['gate'], owners: string[], today = TODAY) {
  const task = jest.fn(async () => Promise.resolve());

  return { done: gate.runOnce(owners, today, task), task };
}

describe('MaterializationGate', () => {
  it('SHOULD skip the task inside the TTL', async () => {
    const { gate } = buildGate();

    await run(gate, ['a']).done;
    const second = run(gate, ['a']);
    await second.done;

    expect(second.task).not.toHaveBeenCalled();
  });

  it('SHOULD run again after the TTL', async () => {
    const { clock, gate } = buildGate();

    await run(gate, ['a']).done;
    clock.now += 60001;
    const second = run(gate, ['a']);
    await second.done;

    expect(second.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD run for a today in another month inside the TTL', async () => {
    const { gate } = buildGate();

    await run(gate, ['a']).done;
    const second = run(gate, ['a'], NEXT_MONTH_DAY);
    await second.done;

    expect(second.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD run after invalidate', async () => {
    const { gate } = buildGate();

    await run(gate, ['a']).done;
    gate.invalidate(['a']);
    const second = run(gate, ['a']);
    await second.done;

    expect(second.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD leave the owner unmarked when invalidate happens during a run', async () => {
    const { gate } = buildGate();
    const first = deferredTask();
    const pending = gate.runOnce(['a'], TODAY, first.task);

    gate.invalidate(['a']);
    first.release();
    await pending;

    expect(gate.shouldRun(['a'], TODAY)).toBe(true);
  });

  it('SHOULD run the task once for 10 concurrent calls', async () => {
    const { gate } = buildGate();
    const first = deferredTask();
    const calls = Array.from({ length: 10 }, async () =>
      gate.runOnce(['a', 'b'], TODAY, first.task),
    );

    first.release();
    await Promise.all(calls);

    expect(first.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD mark nothing AND retry when the task fails', async () => {
    const { gate } = buildGate();
    const failing = deferredTask();
    const pending = gate.runOnce(['a'], TODAY, failing.task);

    failing.fail(new Error('boom'));
    await expect(pending).rejects.toThrow('boom');
    const retry = run(gate, ['a']);
    await retry.done;

    expect(retry.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD NOT join a flight started before an invalidation', async () => {
    const { gate } = buildGate();
    const stale = deferredTask();
    const first = gate.runOnce(['a'], TODAY, stale.task);

    gate.invalidate(['a']);
    const fresh = run(gate, ['a']);
    stale.release();
    await Promise.all([first, fresh.done]);

    expect(fresh.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD always run when the TTL is 0', async () => {
    const { gate } = buildGate(0);

    await run(gate, ['a']).done;
    const second = run(gate, ['a']);
    await second.done;

    expect(second.task).toHaveBeenCalledTimes(1);
  });

  it('SHOULD judge each owner on its own entry', async () => {
    const { gate } = buildGate();

    await run(gate, ['a']).done;
    const both = run(gate, ['a', 'b']);
    await both.done;
    const onlyB = run(gate, ['b']);
    await onlyB.done;

    expect(both.task).toHaveBeenCalledTimes(1);
    expect(onlyB.task).not.toHaveBeenCalled();
  });
});
