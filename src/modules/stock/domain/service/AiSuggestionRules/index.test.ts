import { StockUnits } from '@stock/domain/entity/StockEntity';

import { filterAiFields } from './index';

const catalog = {
  categories: [{ id: 'c1', path: 'Laticínios' }],
  locations: [{ id: 'l1', name: 'Geladeira' }],
};

describe('filterAiFields', () => {
  it('SHOULD map a known category path and location name to ids', () => {
    expect(
      filterAiFields(
        { categoryPath: 'Laticínios', locationName: 'Geladeira', openedShelfLifeDays: 5 },
        catalog,
      ),
    ).toEqual({ categoryId: 'c1', locationId: 'l1', openedShelfLifeDays: 5 });
  });

  it('SHOULD drop a category path or location that is not the owner’s', () => {
    expect(filterAiFields({ categoryPath: 'Bebidas', locationName: 'Garagem' }, catalog)).toEqual(
      {},
    );
  });

  it.each([0, 3651, 1.5])('SHOULD drop openedShelfLifeDays %s', (days) => {
    expect(filterAiFields({ openedShelfLifeDays: days }, catalog)).toEqual({});
  });

  it('SHOULD keep valid description, unit and positive package quantity', () => {
    expect(
      filterAiFields(
        { description: ' Leite ', packageQuantity: 1.0004, unit: StockUnits.LITER },
        catalog,
      ),
    ).toEqual({ description: 'Leite', packageQuantity: 1, unit: StockUnits.LITER });
    expect(filterAiFields({ packageQuantity: 0 }, catalog)).toEqual({});
  });
});
