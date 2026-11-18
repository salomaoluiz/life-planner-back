import { StockMapper } from './index';
import { mocks } from './index.mocks';

describe('toDomain', () => {
  it('SHOULD map every column, converting numeric(14,3) decimals to numbers and the lots', () => {
    const result = StockMapper.toDomain({ ...mocks.rawFull, lots: [mocks.rawLot] });

    expect(result).toMatchObject({
      barcode: '7890000000001',
      categoryId: 'cat',
      idealQuantity: 5,
      locationId: 'loc',
      minQuantity: 1.5,
      openedShelfLifeDays: 5,
      owner: 'FAMILY',
      quickStep: 0.5,
      stockOnly: false,
      unit: 'liter',
      warnDaysClosed: 7,
      warnDaysOpened: 1,
    });
    expect(result.lots).toHaveLength(1);
  });

  it('SHOULD leave nullable columns undefined AND have no lots WHEN none are loaded', () => {
    const result = StockMapper.toDomain(mocks.rawMinimal);

    expect(result.barcode).toBeUndefined();
    expect(result.categoryId).toBeUndefined();
    expect(result.idealQuantity).toBeUndefined();
    expect(result.minQuantity).toBeUndefined();
    expect(result.quickStep).toBeUndefined();
    expect(result.openedShelfLifeDays).toBeUndefined();
    expect(result.lots).toEqual([]);
  });
});

describe('toLot', () => {
  it('SHOULD map the decimals and dates', () => {
    expect(StockMapper.toLot(mocks.rawLot)).toMatchObject({
      itemId: 'item',
      openedAt: mocks.rawLot.opened_at,
      quantity: 0.25,
    });
  });

  it('SHOULD leave empty dates undefined', () => {
    const lot = StockMapper.toLot(mocks.rawLotMinimal);

    expect(lot.expirationDate).toBeUndefined();
    expect(lot.openedAt).toBeUndefined();
    expect(lot.purchaseDate).toBeUndefined();
  });
});

describe('toMovement', () => {
  it('SHOULD map the signed delta, reason and author', () => {
    expect(StockMapper.toMovement(mocks.rawMovement)).toMatchObject({
      note: 'note',
      quantity: -1,
      reason: 'EXPIRED',
      type: 'DISCARD',
      userId: 'user',
    });
  });

  it('SHOULD leave note, reason and author undefined WHEN null', () => {
    const movement = StockMapper.toMovement(mocks.rawMovementMinimal);

    expect(movement.note).toBeUndefined();
    expect(movement.reason).toBeUndefined();
    expect(movement.userId).toBeUndefined();
  });
});

describe('toCategory / toLocation', () => {
  it('SHOULD map a category with its parent and finance mapping', () => {
    expect(StockMapper.toCategory(mocks.rawCategory)).toMatchObject({
      financeCategoryId: 'fin',
      name: 'Dairy',
      parentId: 'parent',
      status: 'ACTIVE',
    });
    expect(
      StockMapper.toCategory({ ...mocks.rawCategory, finance_category_id: null, parent_id: null })
        .parentId,
    ).toBeUndefined();
  });

  it('SHOULD map a location', () => {
    expect(StockMapper.toLocation(mocks.rawLocation)).toMatchObject({
      name: 'Pantry',
      owner: 'FAMILY',
      status: 'ARCHIVED',
    });
  });
});
