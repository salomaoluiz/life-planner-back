import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import StockEntity, { StockUnits } from './index';

const dateMock = new Date('2025-01-01T12:00:00Z');

const paramsMock: StockEntity = {
  barcode: '1234567890123',
  brand: 'Test Brand',
  categoryId: 'category-id',
  createdAt: dateMock,
  description: 'Test Product Description',
  id: 'uuid-1234-5678',
  idealQuantity: 5,
  locationId: 'location-id',
  lots: [],
  minQuantity: 1,
  notes: 'Some notes about the product',
  openedShelfLifeDays: 5,
  owner: OwnerType.FAMILY,
  ownerId: 'owner-uuid-1234',
  stockOnly: false,
  unit: StockUnits.KILOGRAM,
  updatedAt: dateMock,
  warnDaysClosed: 7,
  warnDaysOpened: 1,
};

const mandatoryParamsMock = {
  createdAt: dateMock,
  description: 'Mandatory Product',
  id: 'uuid-mandatory',
  owner: OwnerType.USER,
  ownerId: 'owner-mandatory',
  stockOnly: false,
  unit: StockUnits.UNIT,
  updatedAt: dateMock,
  warnDaysClosed: 7,
  warnDaysOpened: 1,
};

function setup(params: ConstructorParameters<typeof StockEntity>[0] = paramsMock) {
  return new StockEntity(params);
}

const mocks = { date: dateMock, mandatoryParams: mandatoryParamsMock, params: paramsMock };
const spies = {};

export { mocks, setup, spies };
