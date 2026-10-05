import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mocks, setup, spies } from './index.mocks';

describe('create', () => {
  it('SHOULD translate to snake_case columns, then map the result', async () => {
    const expiration = new Date('2027-03-01T00:00:00.000Z');

    const result = await setup.create({
      description: 'Rice',
      expirationDate: expiration,
      owner: OwnerType.USER,
      ownerId: 'owner-id',
      quantity: 2,
      unit: StockUnits.KILOGRAM,
    });

    expect(mocks.stockDatasource.create).toHaveBeenCalledWith({
      barcode: undefined,
      brand: undefined,
      description: 'Rice',
      expiration_date: expiration,
      notes: undefined,
      opening_date: undefined,
      owner: 'USER',
      owner_id: 'owner-id',
      purchase_date: undefined,
      quantity: 2,
      unit: 'kilogram',
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.stockPersistence);
    expect(result).toBe(mocks.stockEntity);
  });
});

describe('delete', () => {
  it('SHOULD delegate', async () => {
    await setup.delete('id-1');

    expect(mocks.stockDatasource.delete).toHaveBeenCalledWith('id-1');
  });
});

describe('existsByOwner', () => {
  it('SHOULD ask with snake_case columns', async () => {
    expect(await setup.existsByOwner({ owner: OwnerType.FAMILY, ownerId: 'fam' })).toBe(true);
    expect(mocks.stockDatasource.exists).toHaveBeenCalledWith({
      owner: 'FAMILY',
      owner_id: 'fam',
    });
  });
});

describe('findById', () => {
  it('SHOULD map the row WHEN found', async () => {
    expect(await setup.findById('id-1')).toBe(mocks.stockEntity);
  });

  it('SHOULD return undefined WHEN not found', async () => {
    mocks.stockDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.findById('id-1')).toBeUndefined();
    expect(spies.mapper.toDomain).not.toHaveBeenCalled();
  });
});

describe('findByOwners', () => {
  it('SHOULD map every row', async () => {
    const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];

    expect(await setup.findByOwners(owners)).toEqual([mocks.stockEntity]);
    expect(mocks.stockDatasource.findByOwners).toHaveBeenCalledWith(owners);
  });
});

describe('update', () => {
  it('SHOULD forward only the given fields AND keep null', async () => {
    const result = await setup.update({
      id: 'id-1',
      notes: null,
      owner: OwnerType.FAMILY,
      ownerId: 'fam',
      unit: StockUnits.GRAM,
    });

    expect(mocks.stockDatasource.update).toHaveBeenCalledWith({
      barcode: undefined,
      brand: undefined,
      description: undefined,
      expiration_date: undefined,
      id: 'id-1',
      notes: null,
      opening_date: undefined,
      owner: 'FAMILY',
      owner_id: 'fam',
      purchase_date: undefined,
      quantity: undefined,
      unit: 'gram',
    });
    expect(result).toBe(mocks.stockEntity);
  });
});
