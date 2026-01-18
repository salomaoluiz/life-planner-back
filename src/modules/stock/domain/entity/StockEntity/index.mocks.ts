import StockEntity, { StockUnits } from './index';

// region Mocks

const dateMock = new Date('2025-01-01T12:00:00Z');

const paramsMock: StockEntity = {
  barcode: '1234567890123',
  brand: 'Test Brand',
  description: 'Test Product Description',
  expirationDate: dateMock,
  id: 'uuid-1234-5678',
  notes: 'Some notes about the product',
  openingDate: dateMock,
  ownerId: 'owner-uuid-1234',
  purchaseDate: dateMock,
  quantity: 100,
  unit: StockUnits.GRAM,
};

const mandatoryParamsMock: StockEntity = {
  description: 'Mandatory Product',
  id: 'uuid-mandatory',
  ownerId: 'owner-mandatory',
  quantity: 10,
  unit: StockUnits.UNIT,
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
