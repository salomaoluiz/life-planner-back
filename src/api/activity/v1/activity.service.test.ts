import { ActivityEntityType, ActivityModule } from '@activity/domain/enum';

import { ActivityService } from './activity.service';

const mocks = {
  families: { execute: jest.fn() },
  list: { execute: jest.fn() },
  listItems: { execute: jest.fn() },
};
const service = new ActivityService(
  { activityRetentionDays: 183 } as never,
  mocks.families as never,
  mocks.list as never,
  mocks.listItems as never,
);
const entry = {
  action: 'CREATE',
  actorId: null,
  actorName: 'Ana',
  batch: false,
  batchPreview: null,
  changes: null,
  entityId: 't-1',
  entityType: ActivityEntityType.TRANSACTION,
  id: 'a-1',
  itemExists: true,
  modules: ['FINANCE'],
  occurredAt: new Date('2026-11-24T14:42:10.000Z'),
  ownerId: 'f-1',
  ownerType: 'FAMILY',
  summary: { label: 'Mercado', ownerName: 'Família Silva' },
};

beforeEach(() => {
  jest.resetAllMocks();
  mocks.families.execute.mockResolvedValue([
    { archived: true, familyId: 'f-1', name: 'Família Silva' },
  ]);
});

describe('list', () => {
  it('SHOULD read the user AND every family, archived ones included, with the retention from env', async () => {
    mocks.list.execute.mockResolvedValue({ items: [entry], nextCursor: undefined });

    const result = await service.list('user-1', {
      from: '2026-11-01T00:00:00.000Z',
      module: ActivityModule.FINANCE,
    });

    expect(mocks.list.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleOwners: [
          { owner: 'USER', ownerId: 'user-1' },
          { owner: 'FAMILY', ownerId: 'f-1' },
        ],
        from: new Date('2026-11-01T00:00:00.000Z'),
        retentionDays: 183,
      }),
    );
    expect(result.nextCursor).toBeNull();
    expect(result.items[0]).toMatchObject({
      actor: { id: null, name: 'Ana' },
      occurredAt: '2026-11-24T14:42:10.000Z',
      owner: { id: 'f-1', name: 'Família Silva', type: 'FAMILY' },
    });
  });
});

describe('listItems', () => {
  it('SHOULD null the missing optional fields', async () => {
    mocks.listItems.execute.mockResolvedValue({
      items: [
        {
          action: 'CREATE',
          entityId: 'e',
          entityType: 'TRANSACTION',
          id: 'i',
          itemExists: false,
          label: 'x',
        },
      ],
    });

    const result = await service.listItems('user-1', 'a-1', {});

    expect(result.header).toBeNull();
    expect(result.nextCursor).toBeNull();
    expect(result.items[0]).toMatchObject({
      amountCents: null,
      bookingDate: null,
      sourceName: null,
    });
  });
});
