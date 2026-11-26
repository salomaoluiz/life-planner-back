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

describe('spec 123 columns', () => {
  const day = new Date('2026-11-25T00:00:00.000Z');

  it('SHOULD map the stored forecast, converting decimals and keeping dates', () => {
    const result = StockMapper.toDomain({
      ...mocks.rawFull,
      forecast_computed_on: day,
      forecast_daily_rate: { toString: () => '0.571429' },
      forecast_empty_date: day,
      forecast_leftover_date: day,
      forecast_leftover_lot_id: 'lot',
      forecast_leftover_quantity: { toString: () => '1.000' },
      forecast_min_date: day,
      forecast_status: 'OK',
      forecast_waste_ratio_90d: { toString: () => '0.3333' },
      lots: [],
    } as never);

    expect(result.forecast).toEqual({
      computedOn: day,
      dailyRate: 0.571429,
      emptyDate: day,
      leftoverDate: day,
      leftoverLotId: 'lot',
      leftoverQuantity: 1,
      minDate: day,
      status: 'OK',
      wasteRatio90d: 0.3333,
    });
  });

  it('SHOULD leave the forecast undefined WHEN it was never computed', () => {
    expect(
      StockMapper.toDomain({ ...mocks.rawMinimal, forecast_status: null } as never).forecast,
    ).toBeUndefined();
  });

  it('SHOULD map the movement price and discard value', () => {
    const result = StockMapper.toMovement({
      ...mocks.rawMovement,
      currency: 'BRL',
      unit_price_cents: null,
      value_cents: 489,
      value_source: 'LOT',
    } as never);

    expect(result).toMatchObject({ currency: 'BRL', valueCents: 489, valueSource: 'LOT' });
    expect(result.unitPriceCents).toBeUndefined();
  });

  it('SHOULD map the lot price and the dismissed leftover', () => {
    const result = StockMapper.toLot({
      ...mocks.rawLot,
      currency: 'BRL',
      leftover_dismissed_at: day,
      leftover_dismissed_quantity: { toString: () => '2.000' },
      unit_price_cents: 250,
    } as never);

    expect(result).toMatchObject({
      currency: 'BRL',
      leftoverDismissedAt: day,
      leftoverDismissedQuantity: 2,
      unitPriceCents: 250,
    });
  });
});
