import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { datasource, setup } from './index.mocks';

const owner = { owner: OwnerType.USER, ownerId: 'user' };
const key = { owner: 'USER', owner_id: 'user' };

it('SHOULD translate the list columns when creating, updating and ensuring the default', async () => {
  datasource.create.mockResolvedValue({});
  datasource.update.mockResolvedValue({});
  datasource.ensureDefault.mockResolvedValue({});

  expect(await setup.create({ currency: 'BRL', isDefault: true, name: 'A', ...owner })).toEqual({
    id: 'list',
  });
  expect(datasource.create).toHaveBeenCalledWith({
    currency: 'BRL',
    is_default: true,
    name: 'A',
    owner: 'USER',
    owner_id: 'user',
  });

  await setup.update({ id: 'l', isDefault: false, status: StockCatalogStatus.ARCHIVED });
  expect(datasource.update).toHaveBeenCalledWith({
    currency: undefined,
    id: 'l',
    is_default: false,
    name: undefined,
    status: 'ARCHIVED',
  });

  await setup.ensureDefault(owner, 'Mercado');
  expect(datasource.ensureDefault).toHaveBeenCalledWith(key, 'Mercado');
});

it('SHOULD read lists by id (undefined WHEN missing) and by owners', async () => {
  datasource.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({});
  datasource.findByOwners.mockResolvedValue([{}, {}]);

  expect(await setup.findById('x')).toBeUndefined();
  expect(await setup.findById('x')).toEqual({ id: 'list' });
  expect(await setup.findByOwners([owner], true)).toHaveLength(2);
  expect(datasource.findByOwners).toHaveBeenCalledWith([key], true);
});

it('SHOULD read rows (one, by lists and the restock ones) as records', async () => {
  datasource.findRowById.mockResolvedValueOnce(null).mockResolvedValueOnce({});
  datasource.findRowsByLists.mockResolvedValue([{}]);
  datasource.findRestockRows.mockResolvedValue([{}, {}]);

  expect(await setup.findRowById('r')).toBeUndefined();
  expect(await setup.findRowById('r')).toEqual({ id: 'record' });
  expect(await setup.findRowsByLists(['l'])).toEqual([{ id: 'record' }]);
  expect(await setup.findRestockRows([owner])).toHaveLength(2);
  expect(datasource.findRestockRows).toHaveBeenCalledWith([key]);
});

it('SHOULD add, update and delete rows translating the columns', async () => {
  datasource.addRow.mockResolvedValue({ merged: true, row: {} });
  datasource.updateRow.mockResolvedValue({});

  expect(
    await setup.addRow({
      estimatedUnitPriceCents: 100,
      itemId: 'i',
      listId: 'l',
      origin: undefined,
      quantity: 2,
      restore: true,
      userId: 'u',
    }),
  ).toEqual({ merged: true, row: { id: 'record' } });
  expect(datasource.addRow).toHaveBeenCalledWith({
    description: undefined,
    estimated_unit_price_cents: 100,
    item_id: 'i',
    list_id: 'l',
    origin: undefined,
    quantity: 2,
    restore: true,
    unit: undefined,
    user_id: 'u',
  });

  await setup.updateRow({ estimatedUnitPriceCents: null, id: 'r', quantity: 3 });
  expect(datasource.updateRow).toHaveBeenCalledWith({
    description: undefined,
    estimated_unit_price_cents: null,
    id: 'r',
    quantity: 3,
    unit: undefined,
  });

  await setup.deleteRow('r', 'u');
  await setup.deleteByOwner(owner);
  expect(datasource.deleteRow).toHaveBeenCalledWith('r', 'u');
  expect(datasource.deleteByOwner).toHaveBeenCalledWith(key);
});
