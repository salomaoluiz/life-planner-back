import { UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { assertStockLimits, loadCatalogRefs } from './index';

const base = { stockOnly: false, unit: StockUnits.KILOGRAM };

describe('assertStockLimits', () => {
  it('SHOULD accept a valid minimum and ideal and an item without them', () => {
    expect(() => assertStockLimits({ ...base, idealQuantity: 1, minQuantity: 0.3 })).not.toThrow();
    expect(() => assertStockLimits(base)).not.toThrow();
  });

  it.each([
    ['ideal equals the minimum', { ...base, idealQuantity: 2, minQuantity: 2 }],
    ['ideal below the minimum', { ...base, idealQuantity: 1, minQuantity: 2 }],
    ['a stock-only item with a minimum', { ...base, minQuantity: 1, stockOnly: true }],
    ['a stock-only item with an ideal', { ...base, idealQuantity: 1, stockOnly: true }],
    [
      'a decimal minimum on a UNIT item',
      { minQuantity: 1.5, stockOnly: false, unit: StockUnits.UNIT },
    ],
    ['4 decimals on a kg ideal', { ...base, idealQuantity: 0.0004 }],
  ])('SHOULD refuse %s with 422', (_label, limits) => {
    expect(() => assertStockLimits(limits)).toThrow(UnprocessableEntityException);
  });
});

describe('loadCatalogRefs', () => {
  const target = { owner: OwnerType.USER, ownerId: 'user' };
  const row = { owner: OwnerType.USER, ownerId: 'user', status: StockCatalogStatus.ACTIVE };
  const catalog = {
    findCategoryById: jest.fn(),
    findLocationById: jest.fn(),
  };
  const repo = catalog as never;

  beforeEach(() => {
    jest.clearAllMocks();
    catalog.findCategoryById.mockResolvedValue({ ...row, id: 'c' });
    catalog.findLocationById.mockResolvedValue({ ...row, id: 'l' });
  });

  it('SHOULD return the rows WHEN they belong to the owner and are active', async () => {
    const refs = await loadCatalogRefs(repo, target, { categoryId: 'c', locationId: 'l' });

    expect(refs.category?.id).toBe('c');
    expect(refs.location?.id).toBe('l');
  });

  it('SHOULD not read anything WHEN no ids are given', async () => {
    expect(await loadCatalogRefs(repo, target, {})).toEqual({
      category: undefined,
      location: undefined,
    });
    expect(catalog.findCategoryById).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['of another owner', { ...row, ownerId: 'other' }],
    ['archived', { ...row, status: StockCatalogStatus.ARCHIVED }],
  ])('SHOULD refuse a category that is %s', async (_label, found) => {
    catalog.findCategoryById.mockResolvedValue(found);

    await expect(loadCatalogRefs(repo, target, { categoryId: 'c' })).rejects.toThrow(
      'Category not found for this owner',
    );
  });

  it('SHOULD refuse a location of another owner', async () => {
    catalog.findLocationById.mockResolvedValue({ ...row, owner: OwnerType.FAMILY });

    await expect(loadCatalogRefs(repo, target, { locationId: 'l' })).rejects.toThrow(
      'Location not found for this owner',
    );
  });
});
