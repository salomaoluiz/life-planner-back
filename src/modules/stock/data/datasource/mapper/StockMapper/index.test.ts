import { StockMapper } from './index';
import { mocks } from './index.mocks';

describe('toDomain', () => {
  it('SHOULD map every column', () => {
    expect(StockMapper.toDomain(mocks.rawFull)).toEqual({
      barcode: mocks.rawFull.barcode,
      brand: mocks.rawFull.brand,
      createdAt: mocks.rawFull.created_at,
      description: mocks.rawFull.description,
      expirationDate: mocks.rawFull.expiration_date,
      id: mocks.rawFull.id,
      notes: mocks.rawFull.notes,
      openingDate: mocks.rawFull.opening_date,
      owner: 'FAMILY',
      ownerId: mocks.rawFull.owner_id,
      purchaseDate: mocks.rawFull.purchase_date,
      quantity: 6,
      unit: 'liter',
      updatedAt: mocks.rawFull.updated_at,
    });
  });

  it('SHOULD turn DB null into undefined for every optional column', () => {
    const result = StockMapper.toDomain(mocks.rawMinimal);

    expect(result.barcode).toBeUndefined();
    expect(result.brand).toBeUndefined();
    expect(result.expirationDate).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.openingDate).toBeUndefined();
    expect(result.purchaseDate).toBeUndefined();
  });
});
