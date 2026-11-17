import StockEntity from './index';
import { mocks, setup } from './index.mocks';

describe('StockEntity', () => {
  it('SHOULD keep every property', () => {
    const result = setup();

    expect(result).toBeInstanceOf(StockEntity);
    expect(result).toEqual(mocks.params);
  });

  it('SHOULD leave optional properties undefined and lots empty WHEN only the mandatory ones are given', () => {
    const result = setup(mocks.mandatoryParams);

    expect(result.lots).toEqual([]);
    expect(result.barcode).toBeUndefined();
    expect(result.categoryId).toBeUndefined();
    expect(result.minQuantity).toBeUndefined();
    expect(result.openedShelfLifeDays).toBeUndefined();
  });
});
