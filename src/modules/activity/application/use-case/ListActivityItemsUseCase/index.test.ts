import { NotFoundException } from '@nestjs/common';

import { ActivityEntityType } from '@activity/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ListActivityItemsUseCase } from './index';

const repository = {
  existingRefs: jest.fn(),
  findEntry: jest.fn(),
  listItemRefs: jest.fn(),
  listItems: jest.fn(),
};
const setup = new ListActivityItemsUseCase(repository as never);
const input = { accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'u-1' }], id: 'entry-1' };
const header = {
  bookingFrom: '2026-10-01',
  bookingTo: '2026-10-31',
  count: 2,
  sources: ['Conta'],
  totals: [{ amountCents: -100, currency: 'BRL' }],
};

function item(id: string, extra: object = {}) {
  return {
    action: 'CREATE',
    bookingDate: '2026-10-31',
    entityId: `e-${id}`,
    entityType: ActivityEntityType.TRANSACTION,
    id,
    label: id,
    ...extra,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  repository.findEntry.mockResolvedValue({ batch: true, id: 'entry-1' });
  repository.existingRefs.mockResolvedValue(new Set(['TRANSACTION:e-a']));
  repository.listItemRefs.mockResolvedValue([
    { entityId: 'e-a', entityType: ActivityEntityType.TRANSACTION },
    { entityId: 'e-b', entityType: ActivityEntityType.TRANSACTION },
  ]);
});

describe('ListActivityItemsUseCase', () => {
  it('SHOULD answer 404 WHEN the entry is unknown, unreadable or not a batch', async () => {
    repository.findEntry.mockResolvedValue(null);
    await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

    repository.findEntry.mockResolvedValue({ batch: false, id: 'entry-1' });
    await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD return the header with the still-existing count on the first page only', async () => {
    repository.listItems.mockResolvedValue({
      hasMore: false,
      header,
      items: [item('a'), item('b')],
    });

    const first = await setup.execute(input);

    expect(first.header).toEqual({ ...header, existing: 1 });
    expect(first.items.map((row) => row.itemExists)).toEqual([true, false]);

    repository.listItems.mockResolvedValue({ hasMore: false, header: null, items: [item('a')] });

    const next = await setup.execute({
      ...input,
      cursor: Buffer.from('2026-10-31|x').toString('base64'),
    });

    expect(next.header).toBeUndefined();
    expect(repository.listItems.mock.calls[1][2]).toBe(false);
  });

  it('SHOULD return a next cursor WHEN there is another page', async () => {
    repository.listItems.mockResolvedValue({ hasMore: true, header, items: [item('a')] });

    const result = await setup.execute(input);

    expect(result.nextCursor).toBe(Buffer.from('2026-10-31|a').toString('base64'));
  });
});
