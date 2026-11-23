import { mocks, setup, useCases } from './shoppingList.service.mocks';

const { accessibleOwners, list, rowView, userId } = mocks;

it('SHOULD output the cards with counts and the estimate', async () => {
  useCases.getLists.execute.mockResolvedValue([
    { autoCount: 1, estimatedTotalCents: 300, list, pricedCount: 1, rowCount: 2 },
  ]);

  const result = await setup.findAll(userId, { includeArchived: true, ownerId: 'o' }, 'en-US');

  expect(useCases.getLists.execute).toHaveBeenCalledWith({
    accessibleOwners,
    includeArchived: true,
    language: 'en-US',
    ownerId: 'o',
  });
  expect(result.items[0]).toMatchObject({
    autoCount: 1,
    currency: 'BRL',
    defaultFinanceCategoryId: null,
    defaultMarketId: null,
    estimatedTotalCents: 300,
    id: 'list',
    isDefault: true,
    pricedCount: 1,
    rowCount: 2,
  });
});

it('SHOULD output the detail with nulls for absent values and the category without a parent', async () => {
  useCases.getById.execute.mockResolvedValue({
    groups: [
      {
        category: { archived: false, id: 'c', name: 'Dairy', path: 'Dairy' },
        rows: [rowView],
        subtotalCents: 2934,
        unpricedCount: 0,
      },
      {
        rows: [
          {
            ...rowView,
            estimateCents: undefined,
            itemId: undefined,
            stock: undefined,
            unitPriceCents: undefined,
          },
        ],
        subtotalCents: 0,
        unpricedCount: 1,
      },
    ],
    list,
    totals: { autoCount: 1, estimatedTotalCents: 2934, pricedCount: 1, rowCount: 2 },
  });

  const detail = await setup.findById(userId, 'list');

  expect(detail.groups[0].category).toEqual({ id: 'c', name: 'Dairy', path: 'Dairy' });
  expect(detail.groups[0].rows[0]).toMatchObject({
    estimateCents: 2934,
    stock: { categoryPath: 'Dairy', idealQuantity: 8, minQuantity: 3, quantity: 2 },
  });
  expect(detail.groups[1].category).toBeNull();
  expect(detail.groups[1].rows[0]).toMatchObject({
    estimateCents: null,
    itemId: null,
    stock: null,
    unitPriceCents: null,
  });
  expect(detail.totals.rowCount).toBe(2);
});

it('SHOULD create and update lists with the accessible owners', async () => {
  useCases.create.execute.mockResolvedValue(list);
  useCases.update.execute.mockResolvedValue(list);

  await setup.create(userId, { name: 'A', owner: 'USER' as never, ownerId: userId }, 'pt-BR');
  await setup.update(userId, 'list', { name: 'B' });

  expect(useCases.create.execute).toHaveBeenCalledWith(
    expect.objectContaining({ accessibleOwners, language: 'pt-BR', name: 'A' }),
  );
  expect(useCases.update.execute).toHaveBeenCalledWith({ accessibleOwners, id: 'list', name: 'B' });
});

it('SHOULD add, update and delete rows', async () => {
  useCases.addRow.execute.mockResolvedValue({ merged: true, row: rowView });
  useCases.updateRow.execute.mockResolvedValue(rowView);

  expect(await setup.addRow(userId, 'list', { itemId: 'item', quantity: 6 })).toMatchObject({
    merged: true,
    row: { id: 'row' },
  });
  expect(useCases.addRow.execute).toHaveBeenCalledWith({
    accessibleOwners,
    itemId: 'item',
    listId: 'list',
    quantity: 6,
    userId,
  });
  expect(await setup.updateRow(userId, 'row', { quantity: 2 })).toMatchObject({ id: 'row' });

  await setup.deleteRow(userId, 'row');
  expect(useCases.deleteRow.execute).toHaveBeenCalledWith({ accessibleOwners, id: 'row', userId });
});

it('SHOULD name the family of each group of the restock summary (personal lists have none)', async () => {
  useCases.restock.execute.mockResolvedValue({
    count: 2,
    groups: [
      { list: mocks.family, rows: [{ description: 'Milk', quantity: 6, unit: 'unit' }] },
      { list, rows: [{ description: 'Soap', quantity: 1, unit: 'unit' }] },
    ],
    totals: [{ currency: 'BRL', estimatedTotalCents: 100, pricedCount: 1 }],
  });

  const summary = await setup.restockSummary(userId);

  expect(summary.groups.map((group) => group.list.ownerName)).toEqual(['Casa', null]);
  expect(summary.count).toBe(2);
  expect(summary.totals).toHaveLength(1);
});
