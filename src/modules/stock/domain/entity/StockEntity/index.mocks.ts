import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import StockEntity, { StockUnits } from './index';

// region Mocks

const dateMock = new Date('2025-01-01T12:00:00Z');

const paramsMock: StockEntity = {
  barcode: '1234567890123',
  brand: 'Test Brand',
  createdAt: dateMock,
  description: 'Test Product Description',
  expirationDate: dateMock,
  id: 'uuid-1234-5678',
  notes: 'Some notes about the product',
  openingDate: dateMock,
  owner: OwnerType.FAMILY,
  ownerId: 'owner-uuid-1234',
  purchaseDate: dateMock,
  quantity: 100,
  unit: StockUnits.GRAM,
  updatedAt: dateMock,
};

const mandatoryParamsMock: StockEntity = {
  createdAt: dateMock,
  description: 'Mandatory Product',
  id: 'uuid-mandatory',
  owner: OwnerType.USER,
  ownerId: 'owner-mandatory',
  quantity: 10,
  unit: StockUnits.UNIT,
  updatedAt: dateMock,
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new StockEntity(params);
}

const mocks = {
  date: dateMock,
  mandatoryParams: mandatoryParamsMock,
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
