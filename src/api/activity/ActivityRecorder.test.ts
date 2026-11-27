import { CallHandler, ExecutionContext } from '@nestjs/common';

import { ReadActivityGroupUseCase } from '@activity/application/use-case/ReadActivityGroupUseCase';
import { ReadActivitySnapshotUseCase } from '@activity/application/use-case/ReadActivitySnapshotUseCase';
import { RecordActivityUseCase } from '@activity/application/use-case/RecordActivityUseCase';
import { ActivityAction, ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { Database } from '@shared/infra/db/Database';
import { fromPromise, lastValueFrom, valueStream } from '@shared/infra/http/request-context';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

import { ActivityDescriptor, ActivityRecorderInterceptor, DeferredJson } from './ActivityRecorder';

const reflector = { get: jest.fn() };
const database = { runInTransaction: jest.fn(async (work: () => Promise<unknown>) => work()) };
const reader = { execute: jest.fn() };
const group = { execute: jest.fn() };
const record = { execute: jest.fn() };
const findUser = { execute: jest.fn() };
const dependencies = new Map<unknown, unknown>([
  [Database, database],
  [FindUserByIdUseCase, findUser],
  [ReadActivityGroupUseCase, group],
  [ReadActivitySnapshotUseCase, reader],
  [RecordActivityUseCase, record],
]);
const moduleRef = { get: (token: unknown) => dependencies.get(token) };
const setup = new ActivityRecorderInterceptor(reflector as never, moduleRef as never);
const request = { body: { a: 1 }, params: { id: 't-1' }, query: {}, user: { id: 'user-1' } };
const response = { json: jest.fn(), status: jest.fn().mockReturnThis() };
const context = {
  getHandler: () => 'handler',
  switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
} as unknown as ExecutionContext;
function descriptor(overrides: Partial<ActivityDescriptor> = {}): ActivityDescriptor {
  return {
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.TRANSACTION,
    ...overrides,
  };
}
async function run(handle: () => Promise<unknown>) {
  const next: CallHandler = { handle: () => fromPromise(handle) };

  return lastValueFrom(setup.intercept(context, next) as never);
}
function snapshot(label: string) {
  return { label };
}

beforeEach(() => {
  jest.clearAllMocks();
  record.execute.mockReset();
  findUser.execute.mockResolvedValue({ id: 'user-1', name: 'Ana' });
  reader.execute.mockImplementation(async () => snapshot('x'));
});

describe('ActivityRecorderInterceptor', () => {
  it('SHOULD send a deferred JSON body only after the transaction committed', async () => {
    reflector.get.mockReturnValue(descriptor({ skipWhen: () => true }));
    database.runInTransaction.mockImplementationOnce(async (work: () => Promise<unknown>) => {
      const result = await work();

      expect(response.json).not.toHaveBeenCalled();

      return result;
    });

    await expect(run(async () => new DeferredJson(201, { created: 2 }))).resolves.toBeUndefined();

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ created: 2 });
  });

  it('SHOULD pass an undecorated route through untouched', async () => {
    reflector.get.mockReturnValue(undefined);
    const next: CallHandler = { handle: () => valueStream('ok') };

    await expect(lastValueFrom(setup.intercept(context, next) as never)).resolves.toBe('ok');
    expect(database.runInTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD read before and after, run the handler AND record, all in one transaction', async () => {
    reflector.get.mockReturnValue(descriptor());
    reader.execute
      .mockResolvedValueOnce(snapshot('before'))
      .mockResolvedValueOnce(snapshot('after'));

    await expect(run(async () => ({ id: 't-1' }))).resolves.toEqual({ id: 't-1' });

    expect(database.runInTransaction).toHaveBeenCalledTimes(1);
    expect(reader.execute).toHaveBeenNthCalledWith(1, { entityType: 'TRANSACTION', id: 't-1' });
    expect(record.execute).toHaveBeenCalledWith({
      action: 'UPDATE',
      actor: { id: 'user-1', name: 'Ana' },
      after: snapshot('after'),
      batch: false,
      before: snapshot('before'),
      extra: undefined,
      items: [],
    });
  });

  it('SHOULD NOT read before on a create AND take the id from the response', async () => {
    request.params = {} as never;
    reflector.get.mockReturnValue(descriptor({ action: ActivityAction.CREATE }));

    await run(async () => ({ id: 'new-1' }));

    expect(reader.execute).toHaveBeenCalledTimes(1);
    expect(reader.execute).toHaveBeenCalledWith({ entityType: 'TRANSACTION', id: 'new-1' });
    expect(record.execute.mock.calls[0][0].before).toBeNull();
    request.params = { id: 't-1' };
  });

  it('SHOULD NOT read after on a delete', async () => {
    reflector.get.mockReturnValue(descriptor({ action: ActivityAction.DELETE }));

    await run(async () => undefined);

    expect(reader.execute).toHaveBeenCalledTimes(1);
    expect(record.execute.mock.calls[0][0].after).toBeNull();
  });

  it('SHOULD record nothing AND rethrow WHEN the handler throws', async () => {
    reflector.get.mockReturnValue(descriptor());

    await expect(
      run(async () => {
        throw new Error('422');
      }),
    ).rejects.toThrow('422');
    expect(record.execute).not.toHaveBeenCalled();
  });

  it('SHOULD fail the request WHEN the entry cannot be recorded (the transaction rolls back)', async () => {
    reflector.get.mockReturnValue(descriptor());
    record.execute.mockRejectedValue(new Error('insert failed'));

    await expect(run(async () => ({}))).rejects.toThrow('insert failed');
  });

  it('SHOULD skip recording WHEN skipWhen says the route did not write', async () => {
    reflector.get.mockReturnValue(descriptor({ skipWhen: () => true }));

    await expect(run(async () => 'dry')).resolves.toBe('dry');
    expect(record.execute).not.toHaveBeenCalled();
  });

  it('SHOULD list the rows that changed WHEN the route is a batch (group read before and after)', async () => {
    function row(id: string, amountCents: number) {
      return {
        action: ActivityAction.CREATE,
        amountCents,
        entityId: id,
        entityType: ActivityEntityType.TRANSACTION,
        label: id,
      };
    }

    reflector.get.mockReturnValue(
      descriptor({
        extra: () => ({ scope: 'ALL' }),
        group: (ctx) => ({ id: ctx.params.id, kind: ActivityGroupKind.RECURRENCE_ROWS }),
      }),
    );
    group.execute
      .mockResolvedValueOnce([row('a', 1), row('b', 1)])
      .mockResolvedValueOnce([row('a', 2), row('b', 1)]);

    await run(async () => ({}));

    expect(group.execute).toHaveBeenCalledWith({ id: 't-1', kind: 'RECURRENCE_ROWS' });
    expect(record.execute.mock.calls[0][0]).toMatchObject({
      batch: true,
      extra: { scope: 'ALL' },
      items: [expect.objectContaining({ action: 'UPDATE', entityId: 'a' })],
    });
  });

  it('SHOULD be a single entry WHEN the group function returns undefined (scope ONLY_THIS)', async () => {
    reflector.get.mockReturnValue(descriptor({ group: () => undefined }));

    await run(async () => ({}));

    expect(group.execute).not.toHaveBeenCalled();
    expect(record.execute.mock.calls[0][0]).toMatchObject({ batch: false, items: [] });
  });

  it('SHOULD use the snapshot override instead of reading the after item', async () => {
    reflector.get.mockReturnValue(
      descriptor({
        action: ActivityAction.CREATE,
        snapshot: async () => snapshot('import') as never,
      }),
    );

    await run(async () => ({}));

    expect(reader.execute).not.toHaveBeenCalled();
    expect(record.execute.mock.calls[0][0].after).toEqual(snapshot('import'));
  });
});
