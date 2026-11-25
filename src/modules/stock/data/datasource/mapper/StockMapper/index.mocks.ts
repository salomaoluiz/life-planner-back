import { faker } from '@faker-js/faker';

import { StockCategory, StockItem, StockLocation, StockLot, StockMovement } from '@db/client';

function decimal(value: number) {
  return { toString: () => String(value) };
}
const date = new Date('2026-11-10T00:00:00.000Z');

const rawFull = {
  barcode: '7890000000001',
  brand: 'Test Brand',
  category_id: 'cat',
  created_at: faker.date.past(),
  description: 'Whole milk',
  forecast_daily_rate: null,
  forecast_leftover_quantity: null,
  forecast_status: null,
  forecast_waste_ratio_90d: null,
  id: faker.string.uuid(),
  ideal_quantity: decimal(5),
  location_id: 'loc',
  min_quantity: decimal(1.5),
  name_embedding: undefined,
  notes: 'Some notes',
  opened_shelf_life_days: 5,
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  quick_step: decimal(0.5),
  stock_only: false,
  unit: 'liter',
  updated_at: faker.date.recent(),
  warn_days_closed: 7,
  warn_days_opened: 1,
} as unknown as StockItem;
const rawMinimal = {
  ...rawFull,
  barcode: null,
  brand: null,
  category_id: null,
  ideal_quantity: null,
  location_id: null,
  min_quantity: null,
  notes: null,
  opened_shelf_life_days: null,
  quick_step: null,
} as unknown as StockItem;
const rawLot = {
  created_at: date,
  currency: null,
  expiration_date: date,
  id: 'lot',
  item_id: 'item',
  leftover_dismissed_at: null,
  leftover_dismissed_quantity: null,
  opened_at: date,
  purchase_date: date,
  quantity: decimal(0.25),
  unit_price_cents: null,
  updated_at: date,
} as unknown as StockLot;
const rawLotMinimal = {
  ...rawLot,
  expiration_date: null,
  opened_at: null,
  purchase_date: null,
} as unknown as StockLot;
const rawMovement = {
  created_at: date,
  id: 'mov',
  item_id: 'item',
  lot_id: 'lot',
  note: 'note',
  quantity: decimal(-1),
  reason: 'EXPIRED',
  type: 'DISCARD',
  user_id: 'user',
} as unknown as StockMovement;
const rawMovementMinimal = {
  ...rawMovement,
  note: null,
  reason: null,
  user_id: null,
} as unknown as StockMovement;
const rawCategory = {
  created_at: date,
  finance_category_id: 'fin',
  id: 'cat',
  name: 'Dairy',
  owner: 'USER',
  owner_id: 'user',
  parent_id: 'parent',
  status: 'ACTIVE',
  updated_at: date,
} as unknown as StockCategory;
const rawLocation = {
  created_at: date,
  id: 'loc',
  name: 'Pantry',
  owner: 'FAMILY',
  owner_id: 'family',
  status: 'ARCHIVED',
  updated_at: date,
} as unknown as StockLocation;

export const mocks = {
  rawCategory,
  rawFull,
  rawLocation,
  rawLot,
  rawLotMinimal,
  rawMinimal,
  rawMovement,
  rawMovementMinimal,
};
