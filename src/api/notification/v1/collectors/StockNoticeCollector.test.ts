import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { StockNoticeCollector } from './StockNoticeCollector';

const find = { execute: jest.fn() };
const setup = new StockNoticeCollector(find as never);
const lot = {
  daysLeft: 0,
  description: 'Iogurte natural',
  expiresOn: '2026-11-23',
  itemId: 'item-1',
  location: 'Geladeira',
  lotId: 'lot-1',
  opened: false,
  owner: OwnerType.FAMILY,
  ownerId: 'family-1',
  quantity: 2,
  unit: 'unit',
};
const request = {
  localDate: '2026-11-23',
  ownerNames: { 'family-1': 'Casa Exemplo' },
  owners: [{ owner: OwnerType.FAMILY, ownerId: 'family-1' }],
};

beforeEach(() => jest.clearAllMocks());

it('SHOULD turn a closed lot due today into STOCK_EXPIRING / DUE_TODAY with the stock route and a snapshot', async () => {
  find.execute.mockResolvedValue([lot]);

  expect(await setup.collect(request)).toEqual([
    {
      dueDate: '2026-11-23',
      module: 'STOCK',
      owner: OwnerType.FAMILY,
      ownerId: 'family-1',
      route: '/stock/items/item-1?lot=lot-1&ownerId=family-1',
      snapshot: {
        description: 'Iogurte natural',
        location: 'Geladeira',
        ownerName: 'Casa Exemplo',
        quantity: 2,
        unit: 'unit',
      },
      sourceId: 'lot-1',
      state: 'DUE_TODAY',
      type: 'STOCK_EXPIRING',
    },
  ]);
  expect(find.execute).toHaveBeenCalledWith({ owners: request.owners, today: '2026-11-23' });
});

it('SHOULD use the opened type for an open lot, OVERDUE for an expired one AND UPCOMING for a future one', async () => {
  find.execute.mockResolvedValue([
    { ...lot, expiresOn: '2026-11-20', opened: true },
    { ...lot, expiresOn: '2026-11-26', location: null, lotId: 'lot-2' },
  ]);

  const items = await setup.collect(request);

  expect(items.map((item) => [item.type, item.state])).toEqual([
    ['STOCK_OPENED_EXPIRING', 'OVERDUE'],
    ['STOCK_EXPIRING', 'UPCOMING'],
  ]);
  expect(items[1].snapshot.location).toBeUndefined();
});
