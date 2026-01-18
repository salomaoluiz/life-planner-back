import StockEntity from './index';
import { mocks, setup } from './index.mocks';

describe('StockEntity', () => {
  it('SHOULD create an instance of StockEntity with all properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(StockEntity);
    expect(result).toEqual(mocks.params);
    expect(result.unit).toBe(mocks.params.unit);
    expect(result.expirationDate).toBe(mocks.date);
  });

  it('SHOULD create an instance with only mandatory properties AND optional properties undefined', () => {
    const result = setup(mocks.mandatoryParams);

    expect(result).toBeInstanceOf(StockEntity);
    expect(result.id).toBe(mocks.mandatoryParams.id);
    expect(result.description).toBe(mocks.mandatoryParams.description);

    // Validating optional properties are undefined
    expect(result.barcode).toBeUndefined();
    expect(result.brand).toBeUndefined();
    expect(result.expirationDate).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.openingDate).toBeUndefined();
    expect(result.purchaseDate).toBeUndefined();
  });
});
