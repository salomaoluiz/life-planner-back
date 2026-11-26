import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { assertIcon, buildCascade, MOVE_TO_NONE, planDelete } from './index';

const rows = [
  { id: 'a', status: StockCatalogStatus.ACTIVE },
  { id: 'b', status: StockCatalogStatus.ACTIVE },
  { id: 'c', status: StockCatalogStatus.ARCHIVED },
  { id: 'd', status: StockCatalogStatus.ACTIVE },
];

describe('assertIcon', () => {
  it('SHOULD refuse a name missing from the catalog', () => {
    expect(() => assertIcon('nope', ['cart'])).toThrow(UnprocessableEntityException);
  });

  it('SHOULD accept a known name, no name or no catalog', () => {
    expect(() => assertIcon('cart', ['cart'])).not.toThrow();
    expect(() => assertIcon(undefined, ['cart'])).not.toThrow();
    expect(() => assertIcon('nope', undefined)).not.toThrow();
  });
});

describe('buildCascade', () => {
  it('SHOULD do nothing WHEN applyToChildren is off or nothing is active', () => {
    expect(buildCascade(rows, ['b'], { applyToChildren: false })).toBeUndefined();
    expect(buildCascade(rows, ['c'], { applyToChildren: true })).toBeUndefined();
  });

  it('SHOULD cover only active descendants and their sent colors', () => {
    expect(
      buildCascade(rows, ['b', 'c', 'd'], {
        applyToChildren: true,
        childColors: { b: '#112233', c: '#445566', x: '#778899' },
        icon: 'cart',
      }),
    ).toEqual({ colors: { b: '#112233' }, icon: 'cart', ids: ['b', 'd'] });
  });
});

describe('planDelete', () => {
  const options = { inUseMessage: 'in use' };

  it('SHOULD ignore moveTo WHEN no item uses the subtree', () => {
    expect(planDelete(rows, ['a'], 0, { ...options, moveTo: 'b' })).toBeUndefined();
  });

  it('SHOULD answer 409 with the count WHEN items use it and nothing was decided', () => {
    expect(() => planDelete(rows, ['a'], 9, options)).toThrow(ConflictException);
  });

  it('SHOULD leave the items without a parent WHEN moveTo is none', () => {
    expect(planDelete(rows, ['a', 'b'], 3, { ...options, moveTo: MOVE_TO_NONE })).toEqual({
      from: ['a', 'b'],
      to: null,
    });
  });

  it('SHOULD move to an active row outside the subtree', () => {
    expect(planDelete(rows, ['a'], 3, { ...options, moveTo: 'd' })).toEqual({
      from: ['a'],
      to: 'd',
    });
  });

  it.each(['b', 'c', 'missing'])('SHOULD refuse %s as target', (moveTo) => {
    expect(() => planDelete(rows, ['a', 'b'], 3, { ...options, moveTo })).toThrow(
      UnprocessableEntityException,
    );
  });
});
