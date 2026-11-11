import { Prisma } from '@db/client';

import { recomputeSuggestions } from './index';

const suggestionFindMany = jest.fn();
const suggestionUpdate = jest.fn();
const suggestionDelete = jest.fn();
const operationFindMany = jest.fn();
const assetFindUnique = jest.fn();
const tx = {
  investmentAsset: { findUnique: assetFindUnique },
  investmentIncomeSuggestion: {
    delete: suggestionDelete,
    findMany: suggestionFindMany,
    update: suggestionUpdate,
  },
  investmentOperation: { findMany: operationFindMany },
} as unknown as Prisma.TransactionClient;

function op(id: string, date: string, quantity: string, type: 'BUY' | 'SELL') {
  return {
    bonus_percent: null,
    bonus_unit_cost: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    date: new Date(`${date}T00:00:00Z`),
    fraction_of_operation_id: null,
    id,
    quantity: new Prisma.Decimal(quantity),
    ratio_from: null,
    ratio_to: null,
    total: 1000,
    type,
  };
}
function suggestion(quantity: string) {
  return {
    event: { ex_date: new Date('2026-11-21T00:00:00Z') },
    id: 'sug-1',
    quantity: new Prisma.Decimal(quantity),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  assetFindUnique.mockResolvedValue({ asset_class: 'BR_STOCK' });
});

describe('recomputeSuggestions', () => {
  it('SHOULD read nothing else WHEN the asset has no pending suggestion', async () => {
    suggestionFindMany.mockResolvedValue([]);

    await recomputeSuggestions(tx, 'asset-1');

    expect(operationFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD update the quantity to the position at the ex-date (later operations ignored)', async () => {
    suggestionFindMany.mockResolvedValue([suggestion('300')]);
    operationFindMany.mockResolvedValue([
      op('b1', '2026-01-10', '300', 'BUY'),
      op('b2', '2026-11-20', '100', 'BUY'),
      op('b3', '2026-12-01', '500', 'BUY'),
    ]);

    await recomputeSuggestions(tx, 'asset-1');

    expect(suggestionUpdate).toHaveBeenCalledWith({
      data: { quantity: '400.00000000' },
      where: { id: 'sug-1' },
    });
  });

  it('SHOULD keep the suggestion WHEN the quantity did not change', async () => {
    suggestionFindMany.mockResolvedValue([suggestion('300')]);
    operationFindMany.mockResolvedValue([op('b1', '2026-01-10', '300', 'BUY')]);

    await recomputeSuggestions(tx, 'asset-1');

    expect(suggestionUpdate).not.toHaveBeenCalled();
    expect(suggestionDelete).not.toHaveBeenCalled();
  });

  it('SHOULD drop the suggestion WHEN the position at the ex-date is zero', async () => {
    suggestionFindMany.mockResolvedValue([suggestion('300')]);
    operationFindMany.mockResolvedValue([
      op('b1', '2026-01-10', '300', 'BUY'),
      op('s1', '2026-11-01', '300', 'SELL'),
    ]);

    await recomputeSuggestions(tx, 'asset-1');

    expect(suggestionDelete).toHaveBeenCalledWith({ where: { id: 'sug-1' } });
  });
});
