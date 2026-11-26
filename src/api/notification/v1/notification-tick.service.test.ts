import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { LogLevel } from '@shared/infra/logger/types';

import { NotificationTickService } from './notification-tick.service';

const mocks = {
  access: { execute: jest.fn() },
  checkReceipts: { execute: jest.fn() },
  cleanup: { execute: jest.fn() },
  createSummary: { execute: jest.fn() },
  createUrgent: { execute: jest.fn() },
  finance: { collect: jest.fn() },
  findDue: { execute: jest.fn() },
  logger: { log: jest.fn() },
  sendPending: { execute: jest.fn() },
  stock: { collect: jest.fn() },
};
function setup() {
  return new NotificationTickService(
    mocks.checkReceipts as never,
    mocks.cleanup as never,
    mocks.createSummary as never,
    mocks.createUrgent as never,
    mocks.finance as never,
    mocks.findDue as never,
    mocks.access as never,
    mocks.logger,
    mocks.sendPending as never,
    mocks.stock as never,
  );
}
const now = new Date('2026-11-23T11:00:00Z'); // 08:00 in São Paulo
function item(
  sourceId: string,
  overrides: Partial<NotificationItemInput> = {},
): NotificationItemInput {
  return {
    dueDate: '2026-11-23',
    module: 'STOCK',
    owner: OwnerType.USER,
    ownerId: 'user-1',
    route: '/r',
    snapshot: { description: sourceId },
    sourceId,
    state: 'DUE_TODAY',
    type: 'STOCK_EXPIRING',
    ...overrides,
  };
}
function user(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    disabledFamilyIds: new Set<string>(),
    preferences: defaultPreferences(userId),
    summaryDue: true,
    urgentDue: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mocks.access.execute.mockResolvedValue([]);
  mocks.findDue.execute.mockResolvedValue({ hasMore: false, users: [] });
  mocks.stock.collect.mockResolvedValue([]);
  mocks.finance.collect.mockResolvedValue([]);
  mocks.createSummary.execute.mockResolvedValue({ id: 'n-1' });
  mocks.createUrgent.execute.mockResolvedValue(1);
  mocks.sendPending.execute.mockResolvedValue({});
  mocks.checkReceipts.execute.mockResolvedValue({});
  mocks.cleanup.execute.mockResolvedValue({});
});

describe('runSummaries', () => {
  it("SHOULD collect once for the user's own owner AND create the summary with the filtered items", async () => {
    mocks.findDue.execute.mockResolvedValue({ hasMore: false, users: [user('user-1')] });
    mocks.stock.collect.mockResolvedValue([item('mine'), item('stranger', { ownerId: 'user-2' })]);

    expect(await setup().runSummaries(now)).toEqual({ created: 1, failedUsers: 0, users: 1 });

    expect(mocks.stock.collect).toHaveBeenCalledWith({
      localDate: '2026-11-23',
      ownerNames: {},
      owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
    });
    expect(mocks.createSummary.execute).toHaveBeenCalledWith({
      items: [expect.objectContaining({ sourceId: 'mine' })],
      now,
      preferences: expect.objectContaining({ userId: 'user-1' }),
    });
  });

  it('SHOULD skip users that are not due for the summary', async () => {
    mocks.findDue.execute.mockResolvedValue({
      hasMore: false,
      users: [user('user-1', { summaryDue: false, urgentDue: true })],
    });

    expect(await setup().runSummaries(now)).toEqual({ created: 0, failedUsers: 0, users: 0 });
    expect(mocks.createSummary.execute).not.toHaveBeenCalled();
  });

  it('SHOULD read each module ONCE for two users that share a family AND give each their own notice', async () => {
    mocks.findDue.execute.mockResolvedValue({
      hasMore: false,
      users: [user('user-1'), user('user-2')],
    });
    mocks.access.execute.mockResolvedValue([
      { archived: false, familyId: 'family-1', name: 'Casa Exemplo' },
    ]);
    mocks.stock.collect.mockResolvedValue([
      item('shared', { owner: OwnerType.FAMILY, ownerId: 'family-1' }),
    ]);

    await setup().runSummaries(now);

    expect(mocks.stock.collect).toHaveBeenCalledTimes(1);
    expect(mocks.stock.collect).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerNames: { 'family-1': 'Casa Exemplo' },
        owners: expect.arrayContaining([
          { owner: OwnerType.USER, ownerId: 'user-1' },
          { owner: OwnerType.USER, ownerId: 'user-2' },
          { owner: OwnerType.FAMILY, ownerId: 'family-1' },
        ]),
      }),
    );
    expect(mocks.createSummary.execute).toHaveBeenCalledTimes(2);
    mocks.createSummary.execute.mock.calls.forEach(([call]) => expect(call.items).toHaveLength(1));
  });

  it('SHOULD leave out archived families AND the families the user turned off, only for that user', async () => {
    mocks.findDue.execute.mockResolvedValue({
      hasMore: false,
      users: [user('user-1', { disabledFamilyIds: new Set(['family-1']) }), user('user-2')],
    });
    mocks.access.execute.mockResolvedValue([
      { archived: false, familyId: 'family-1', name: 'Casa' },
      { archived: true, familyId: 'family-old', name: 'Antiga' },
    ]);
    mocks.stock.collect.mockResolvedValue([
      item('family-item', { owner: OwnerType.FAMILY, ownerId: 'family-1' }),
      item('archived-item', { owner: OwnerType.FAMILY, ownerId: 'family-old' }),
    ]);

    await setup().runSummaries(now);

    const [first, second] = mocks.createSummary.execute.mock.calls.map(([call]) =>
      call.items.map((entry: NotificationItemInput) => entry.sourceId),
    );

    expect(first).toEqual([]);
    expect(second).toEqual(['family-item']);
    expect(mocks.stock.collect.mock.calls[0][0].owners).not.toContainEqual({
      owner: OwnerType.FAMILY,
      ownerId: 'family-old',
    });
  });

  it("SHOULD apply the user's lead days AND enabled types", async () => {
    const preferences = {
      ...defaultPreferences('user-1'),
      disabledTypes: ['FINANCE_INVOICE_DUE' as const],
      invoiceLeadDays: 5,
    };
    mocks.findDue.execute.mockResolvedValue({
      hasMore: false,
      users: [user('user-1', { preferences })],
    });
    mocks.finance.collect.mockResolvedValue([
      item('bill-in-2', {
        dueDate: '2026-11-25',
        module: 'FINANCE',
        state: 'UPCOMING',
        type: 'FINANCE_BILL_DUE',
      }),
      item('bill-in-4', {
        dueDate: '2026-11-27',
        module: 'FINANCE',
        state: 'UPCOMING',
        type: 'FINANCE_BILL_DUE',
      }),
      item('invoice', {
        dueDate: '2026-11-24',
        module: 'FINANCE',
        state: 'UPCOMING',
        type: 'FINANCE_INVOICE_DUE',
      }),
    ]);

    await setup().runSummaries(now);

    expect(
      mocks.createSummary.execute.mock.calls[0][0].items.map(
        (entry: NotificationItemInput) => entry.sourceId,
      ),
    ).toEqual(['bill-in-2']);
  });

  it('SHOULD page through the due users until the last page', async () => {
    mocks.findDue.execute
      .mockResolvedValueOnce({ hasMore: true, lastUserId: 'user-1', users: [user('user-1')] })
      .mockResolvedValueOnce({ hasMore: false, users: [user('user-2')] });

    expect((await setup().runSummaries(now)).users).toBe(2);
    expect(mocks.findDue.execute).toHaveBeenNthCalledWith(2, {
      afterUserId: 'user-1',
      limit: 200,
      now,
    });
  });

  it('SHOULD count users as failed WITHOUT creating anything WHEN a collector fails (they wait for the next tick)', async () => {
    mocks.findDue.execute.mockResolvedValue({ hasMore: false, users: [user('user-1')] });
    mocks.stock.collect.mockRejectedValue(new Error('db down'));

    expect(await setup().runSummaries(now)).toEqual({ created: 0, failedUsers: 1, users: 1 });
    expect(mocks.createSummary.execute).not.toHaveBeenCalled();
    expect(mocks.logger.log).toHaveBeenCalledWith(
      LogLevel.ERROR,
      'Notification collector failed',
      expect.objectContaining({ error: 'db down' }),
    );
  });

  it('SHOULD keep going WHEN one user fails to be written', async () => {
    mocks.findDue.execute.mockResolvedValue({
      hasMore: false,
      users: [user('user-1'), user('user-2')],
    });
    mocks.createSummary.execute
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(null);

    expect(await setup().runSummaries(now)).toEqual({ created: 0, failedUsers: 1, users: 2 });
  });

  it('SHOULD log a failure that is not an Error as unknown', async () => {
    mocks.findDue.execute.mockResolvedValue({ hasMore: false, users: [user('user-1')] });
    mocks.createSummary.execute.mockRejectedValue('weird');

    await setup().runSummaries(now);

    expect(mocks.logger.log).toHaveBeenCalledWith(
      LogLevel.ERROR,
      'Notification user failed',
      expect.objectContaining({ error: 'unknown' }),
    );
  });
});

describe('runUrgent', () => {
  it('SHOULD create urgent notices only for users whose summary of the day already exists', async () => {
    mocks.findDue.execute.mockResolvedValue({
      hasMore: false,
      users: [
        user('user-1', { summaryDue: false, urgentDue: true }),
        user('user-2', { summaryDue: true, urgentDue: true }),
      ],
    });
    mocks.stock.collect.mockResolvedValue([item('today')]);

    expect(await setup().runUrgent(now)).toEqual({ created: 1, failedUsers: 0, users: 1 });
    expect(mocks.createUrgent.execute).toHaveBeenCalledWith({
      candidates: [expect.objectContaining({ sourceId: 'today' })],
      now,
      preferences: expect.objectContaining({ userId: 'user-1' }),
    });
  });
});

describe('preview', () => {
  const preferences = defaultPreferences('user-1');

  it('SHOULD return the items the summary would have NOW, creating nothing', async () => {
    mocks.stock.collect.mockResolvedValue([item('mine'), item('stranger', { ownerId: 'user-2' })]);

    const items = await setup().preview(preferences, new Set(), now);

    expect(items.map((entry) => entry.sourceId)).toEqual(['mine']);
    expect(mocks.createSummary.execute).not.toHaveBeenCalled();
    expect(mocks.createUrgent.execute).not.toHaveBeenCalled();
  });

  it('SHOULD surface a collector failure instead of answering empty', async () => {
    mocks.finance.collect.mockRejectedValue(new Error('db down'));

    await expect(setup().preview(preferences, new Set(), now)).rejects.toThrow('db down');
  });
});

describe('run', () => {
  it('SHOULD run the five steps in order', async () => {
    await setup().run(new Date('2026-11-23T04:00:00Z'));

    expect(mocks.sendPending.execute).toHaveBeenCalledWith({
      now: new Date('2026-11-23T04:00:00Z'),
    });
    expect(mocks.checkReceipts.execute).toHaveBeenCalledTimes(1);
    expect(mocks.cleanup.execute).toHaveBeenCalledTimes(1);
  });

  it('SHOULD isolate the steps: a failure never stops the others AND the first error is rethrown', async () => {
    mocks.findDue.execute.mockRejectedValue(new Error('first'));
    mocks.checkReceipts.execute.mockRejectedValue(new Error('second'));

    await expect(setup().run(now)).rejects.toThrow('first');

    expect(mocks.sendPending.execute).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(
      LogLevel.ERROR,
      'Notification tick step failed',
      expect.objectContaining({ step: 'receipts' }),
    );
  });

  it('SHOULD log a thrown value that is not an Error as unknown', async () => {
    mocks.sendPending.execute.mockRejectedValue('weird');

    await expect(setup().run(now)).rejects.toBe('weird');
    expect(mocks.logger.log).toHaveBeenCalledWith(
      LogLevel.ERROR,
      'Notification tick step failed',
      expect.objectContaining({ error: 'unknown' }),
    );
  });

  it('SHOULD clean up only on the first tick after 03:00 UTC of each day', async () => {
    const service = setup();

    await service.run(new Date('2026-11-23T02:45:00Z'));
    await service.run(new Date('2026-11-23T03:00:00Z'));
    await service.run(new Date('2026-11-23T03:15:00Z'));
    await service.run(new Date('2026-11-24T03:00:00Z'));

    expect(mocks.cleanup.execute).toHaveBeenCalledTimes(2);
  });

  it('SHOULD try the cleanup again on the next tick WHEN it failed', async () => {
    const service = setup();
    mocks.cleanup.execute.mockRejectedValueOnce(new Error('db'));

    await expect(service.run(new Date('2026-11-23T03:00:00Z'))).rejects.toThrow('db');
    await service.run(new Date('2026-11-23T03:15:00Z'));

    expect(mocks.cleanup.execute).toHaveBeenCalledTimes(2);
  });
});
