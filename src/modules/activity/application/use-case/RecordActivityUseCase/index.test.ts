import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityAction, ActivityEntityType, ActivityModule } from '@activity/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { RecordActivityUseCase } from './index';

const repository = { insert: jest.fn() };
const setup = new RecordActivityUseCase(repository as never);
const actor = { id: 'user-1', name: 'Ana' };
const owner = { ownerId: 'u-1', ownerName: 'Ana', ownerType: OwnerType.USER };

function snapshot(overrides: Partial<ActivitySnapshot> = {}): ActivitySnapshot {
  return {
    amountCents: -120000,
    bookingDate: '2022-04-15',
    currency: 'BRL',
    entityId: 't-1',
    entityType: ActivityEntityType.TRANSACTION,
    fields: { amountCents: -120000, paid: false },
    label: 'Mercado',
    modules: [ActivityModule.FINANCE],
    owners: [owner],
    sources: ['Conta corrente'],
    ...overrides,
  };
}

beforeEach(() => jest.resetAllMocks());

describe('RecordActivityUseCase', () => {
  it('SHOULD record a create with the summary snapshot AND no changes', async () => {
    await setup.execute({
      action: ActivityAction.CREATE,
      actor,
      after: snapshot(),
      batch: false,
      before: null,
    });

    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(repository.insert.mock.calls[0][0]).toMatchObject({
      action: 'CREATE',
      actorId: 'user-1',
      actorName: 'Ana',
      batch: false,
      changes: null,
      entityId: 't-1',
      ownerId: 'u-1',
      summary: {
        amountCents: -120000,
        bookingDate: '2022-04-15',
        label: 'Mercado',
        ownerName: 'Ana',
        sources: ['Conta corrente'],
      },
    });
    expect(repository.insert.mock.calls[0][0].searchText).toContain('1.200,00');
  });

  it('SHOULD record an update with only the fields that changed', async () => {
    await setup.execute({
      action: ActivityAction.UPDATE,
      actor,
      after: snapshot({ fields: { amountCents: -245000, paid: true } }),
      batch: false,
      before: snapshot({ fields: { amountCents: -230000, paid: false } }),
    });

    expect(repository.insert.mock.calls[0][0].changes).toEqual([
      { field: 'amountCents', from: -230000, to: -245000 },
      { field: 'paid', from: false, to: true },
    ]);
  });

  it('SHOULD record nothing WHEN an update changes nothing', async () => {
    await setup.execute({
      action: ActivityAction.UPDATE,
      actor,
      after: snapshot(),
      batch: false,
      before: snapshot(),
    });

    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('SHOULD record a delete from the before snapshot', async () => {
    await setup.execute({
      action: ActivityAction.DELETE,
      actor,
      after: null,
      batch: false,
      before: snapshot(),
    });

    expect(repository.insert.mock.calls[0][0]).toMatchObject({ action: 'DELETE', entityId: 't-1' });
  });

  it('SHOULD record a delete WHEN an update leaves the item gone (a dissolved split)', async () => {
    await setup.execute({
      action: ActivityAction.UPDATE,
      actor,
      after: null,
      batch: false,
      before: snapshot(),
    });

    expect(repository.insert.mock.calls[0][0]).toMatchObject({ action: 'DELETE', changes: null });
  });

  it('SHOULD write one entry per owner touched WHEN the owner changed', async () => {
    const family = { ownerId: 'f-1', ownerName: 'Família', ownerType: OwnerType.FAMILY };

    await setup.execute({
      action: ActivityAction.UPDATE,
      actor,
      after: snapshot({ fields: { owner: 'Família' }, owners: [family] }),
      batch: false,
      before: snapshot({ fields: { owner: 'Ana' } }),
    });

    expect(repository.insert.mock.calls.map(([entry]) => entry.ownerId)).toEqual(['f-1', 'u-1']);
    expect(repository.insert.mock.calls[0][0].summary.ownerName).toBe('Família');
  });

  it('SHOULD keep the items AND a preview of 3 labels on a batch', async () => {
    const items = ['a', 'b', 'c', 'd'].map((label, index) => ({
      action: ActivityAction.CREATE,
      entityId: `e-${index}`,
      entityType: ActivityEntityType.TRANSACTION,
      label,
    }));

    await setup.execute({
      action: ActivityAction.CREATE,
      actor,
      after: snapshot({ entityId: '', entityType: ActivityEntityType.TRANSACTION_IMPORT }),
      batch: true,
      before: null,
      extra: { fileName: 'extrato.csv' },
      items,
    });

    const entry = repository.insert.mock.calls[0][0];

    expect(entry.batch).toBe(true);
    expect(entry.entityId).toBeNull();
    expect(entry.items).toHaveLength(4);
    expect(entry.summary.extra).toEqual({
      fileName: 'extrato.csv',
      itemCount: 4,
      previewLabels: ['a', 'b', 'c'],
    });
  });

  it('SHOULD record a batch update WHEN items exist even if no field changed', async () => {
    await setup.execute({
      action: ActivityAction.UPDATE,
      actor,
      after: snapshot(),
      batch: true,
      before: snapshot(),
      items: [
        {
          action: ActivityAction.UPDATE,
          entityId: 'o-1',
          entityType: ActivityEntityType.TRANSACTION,
          label: 'x',
        },
      ],
    });

    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('SHOULD list both modules WHEN the item changes both', async () => {
    await setup.execute({
      action: ActivityAction.CREATE,
      actor,
      after: snapshot({ modules: [ActivityModule.INVESTMENT, ActivityModule.FINANCE] }),
      batch: false,
      before: null,
    });

    expect(repository.insert.mock.calls[0][0].modules).toEqual(['INVESTMENT', 'FINANCE']);
  });

  it('SHOULD propagate a repository failure so the write rolls back', async () => {
    repository.insert.mockRejectedValue(new Error('db down'));

    await expect(
      setup.execute({
        action: ActivityAction.CREATE,
        actor,
        after: snapshot(),
        batch: false,
        before: null,
      }),
    ).rejects.toThrow('db down');
  });
});
