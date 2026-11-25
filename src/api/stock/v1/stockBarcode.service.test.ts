import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { item, lot } from '@stock/application/mocks/stock.mocks';
import { toStockItemView } from '@stock/application/service/StockView';

import { StockBarcodeService } from './stockBarcode.service';

const userId = 'user-id';
const families = [
  { archived: false, familyId: 'family-1', name: 'Casa' },
  { archived: true, familyId: 'family-2', name: 'Antiga' },
];
const find = jest.fn();
const access = jest.fn();
const usage = jest.fn();
const suggest = jest.fn();
const service = new StockBarcodeService(
  { execute: find } as never,
  { execute: usage } as never,
  { execute: access } as never,
  { execute: suggest } as never,
);
const emptyCatalog = { categories: [], locations: [], shoppingLists: [] };

function view(ownerId: string, owner: OwnerType) {
  return toStockItemView(
    item([lot('l', 2)], (f) => f.withOwner(owner).withOwnerId(ownerId)),
    new Date('2026-11-10T00:00:00.000Z'),
    emptyCatalog,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  access.mockResolvedValue(families);
});

it('SHOULD look the code up in the user AND every family, archived included', async () => {
  find.mockResolvedValue({ code: '123', views: [] });

  const result = await service.findByBarcode(userId, '123');

  expect(find).toHaveBeenCalledWith({
    accessibleOwners: [
      { owner: OwnerType.USER, ownerId: userId },
      { archived: false, owner: OwnerType.FAMILY, ownerId: 'family-1' },
      { archived: true, owner: OwnerType.FAMILY, ownerId: 'family-2' },
    ],
    code: '123',
    today: undefined,
  });
  expect(result).toEqual({ code: '123', matches: [] });
});

it('SHOULD name the owner of each match AND flag archived families as read-only', async () => {
  find.mockResolvedValue({
    code: '123',
    views: [
      view(userId, OwnerType.USER),
      view('family-1', OwnerType.FAMILY),
      view('family-2', OwnerType.FAMILY),
    ],
  });

  const { matches } = await service.findByBarcode(userId, '123');

  expect(matches.map(({ ownerName, readOnly }) => [ownerName, readOnly])).toEqual([
    ['Pessoal', false],
    ['Casa', false],
    ['Antiga', true],
  ]);
});

it('SHOULD suggest with every accessible owner so the use case checks the target', async () => {
  suggest.mockResolvedValue({ ok: true });

  await service.suggest(userId, { barcode: '123', owner: OwnerType.USER, ownerId: userId });

  expect(suggest).toHaveBeenCalledWith({
    accessibleOwners: expect.arrayContaining([{ owner: OwnerType.USER, ownerId: userId }]),
    barcode: '123',
    owner: OwnerType.USER,
    ownerId: userId,
    userId,
  });
});

it('SHOULD read the usage of the user', async () => {
  usage.mockResolvedValue({ light: { limit: 50, used: 1 } });

  expect(await service.getUsage(userId)).toEqual({ light: { limit: 50, used: 1 } });
  expect(usage).toHaveBeenCalledWith({ userId });
});
