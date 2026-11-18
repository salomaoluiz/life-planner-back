import { Prisma, StockShoppingList, StockShoppingListRow } from '@db/client';
import { ShoppingRowWithItem } from '@stock/data/repository/datasource/IShoppingListDatasource';

import { ShoppingListMapper } from './index';

const date = new Date('2026-11-10T00:00:00.000Z');
const list = {
  created_at: date,
  currency: 'BRL',
  id: 'l',
  is_default: true,
  name: 'Mercado',
  owner: 'FAMILY',
  owner_id: 'f',
  status: 'ARCHIVED',
  updated_at: date,
} as unknown as StockShoppingList;
const row = {
  created_at: date,
  created_by: null,
  description: null,
  estimated_unit_price_cents: null,
  id: 'r',
  item_id: 'i',
  list_id: 'l',
  origin: 'AUTO_EDITED',
  quantity: new Prisma.Decimal('6.5'),
  unit: null,
  updated_at: date,
} as unknown as StockShoppingListRow;

it('SHOULD map a list', () => {
  expect(ShoppingListMapper.toList(list)).toMatchObject({
    currency: 'BRL',
    isDefault: true,
    owner: 'FAMILY',
    status: 'ARCHIVED',
  });
});

it('SHOULD map an item row (nulls become undefined, decimals numbers)', () => {
  expect(ShoppingListMapper.toRow(row)).toMatchObject({
    itemId: 'i',
    origin: 'AUTO_EDITED',
    quantity: 6.5,
  });
  expect(ShoppingListMapper.toRow(row).description).toBeUndefined();
});

it('SHOULD map a text row and a record with the item quantity summed from its lots', () => {
  const text = {
    ...row,
    description: 'Candle',
    estimated_unit_price_cents: 1800,
    item_id: null,
    origin: 'MANUAL',
    unit: 'unit',
  } as unknown as StockShoppingListRow;

  expect(ShoppingListMapper.toRow(text)).toMatchObject({
    description: 'Candle',
    estimatedUnitPriceCents: 1800,
    unit: 'unit',
  });

  const record = ShoppingListMapper.toRecord({
    ...row,
    item: {
      category_id: 'c',
      description: 'Milk',
      estimated_unit_price_cents: 489,
      id: 'i',
      ideal_quantity: new Prisma.Decimal(8),
      lots: [{ quantity: new Prisma.Decimal('0.1') }, { quantity: new Prisma.Decimal('0.2') }],
      min_quantity: null,
      owner: 'USER',
      owner_id: 'u',
      unit: 'unit',
    },
    list,
  } as unknown as ShoppingRowWithItem);

  expect(record.item).toMatchObject({
    categoryId: 'c',
    description: 'Milk',
    estimatedUnitPriceCents: 489,
    idealQuantity: 8,
    minQuantity: undefined,
    quantity: 0.3,
  });
  expect(record.list.id).toBe('l');
  expect(
    ShoppingListMapper.toRecord({ ...row, item: null, list } as unknown as ShoppingRowWithItem)
      .item,
  ).toBeUndefined();
});
