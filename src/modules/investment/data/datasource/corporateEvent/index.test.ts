import { Prisma } from '@db/client';
import { FractionSaleBreaksError } from '@investment/domain/error/FractionSaleBreaksError';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';

import { assertPositionValid, recomputeEventSuggestions } from './index';

const assetFindUnique = jest.fn();
const operationFindMany = jest.fn();
const operationUpdate = jest.fn();
const suggestionFindMany = jest.fn();
const suggestionUpdate = jest.fn();
const suggestionDelete = jest.fn();
const tx = {
  investmentAsset: { findUnique: assetFindUnique },
  investmentEventSuggestion: {
    delete: suggestionDelete,
    findMany: suggestionFindMany,
    update: suggestionUpdate,
  },
  investmentOperation: { findMany: operationFindMany, update: operationUpdate },
} as unknown as Prisma.TransactionClient;

const base = {
  bonus_percent: null,
  bonus_unit_cost: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  fraction_of_operation_id: null,
  gross: 1000,
  ratio_from: null,
  ratio_to: null,
};
function buy(id: string, date: string, quantity: string, total = 319100) {
  return row(id, date, 'BUY', { quantity: new Prisma.Decimal(quantity), total });
}
function reverse(id: string, date: string) {
  return row(id, date, 'REVERSE_SPLIT', {
    ratio_from: new Prisma.Decimal('10'),
    ratio_to: new Prisma.Decimal('1'),
  });
}
function row(id: string, date: string, type: string, extra: object = {}) {
  return {
    ...base,
    date: new Date(`${date}T00:00:00Z`),
    id,
    quantity: new Prisma.Decimal('0'),
    total: 0,
    type,
    ...extra,
  };
}
function sale(id: string, date: string, eventId: string, quantity: string) {
  return row(id, date, 'SELL', {
    fraction_of_operation_id: eventId,
    gross: 520,
    quantity: new Prisma.Decimal(quantity),
    total: 520,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  assetFindUnique.mockResolvedValue({ asset_class: 'BR_STOCK' });
});

describe('assertPositionValid', () => {
  it('SHOULD pass a valid history without writing anything', async () => {
    operationFindMany.mockResolvedValue([
      buy('a', '2026-01-10', '3155'),
      reverse('e', '2026-03-10'),
    ]);

    await expect(assertPositionValid(tx, 'asset-1')).resolves.toBeUndefined();
    expect(operationUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD throw the negative position WHEN a later sell needs the old quantity', async () => {
    operationFindMany.mockResolvedValue([
      buy('a', '2026-01-10', '3155'),
      reverse('e', '2026-03-10'),
      row('s', '2026-04-01', 'SELL', { quantity: new Prisma.Decimal('3000'), total: 1 }),
    ]);

    await expect(assertPositionValid(tx, 'asset-1')).rejects.toEqual(
      new NegativePositionError('2026-04-01', 's'),
    );
  });

  it('SHOULD throw no position WHEN an event is dated before the first buy', async () => {
    operationFindMany.mockResolvedValue([
      buy('a', '2026-05-10', '100'),
      reverse('e', '2026-03-10'),
    ]);

    await expect(assertPositionValid(tx, 'asset-1')).rejects.toEqual(
      new NoPositionError('2026-03-10'),
    );
  });

  it('SHOULD refuse WHEN the event leaves no fraction but a fraction sale exists', async () => {
    operationFindMany.mockResolvedValue([
      buy('a', '2026-01-10', '3150', 319100),
      reverse('e', '2026-03-10'),
      sale('f', '2026-04-04', 'e', '0.5'),
    ]);

    await expect(assertPositionValid(tx, 'asset-1')).rejects.toEqual(
      new FractionSaleBreaksError('2026-04-04'),
    );
  });

  it('SHOULD update the sale quantity and unit price WHEN the fraction changed', async () => {
    operationFindMany.mockResolvedValue([
      buy('a', '2026-01-10', '3157', 319100),
      reverse('e', '2026-03-10'),
      sale('f', '2026-04-04', 'e', '0.5'),
    ]);

    await assertPositionValid(tx, 'asset-1');

    expect(operationUpdate).toHaveBeenCalledWith({
      data: { quantity: '0.70000000', unit_price: '7.42857143' },
      where: { id: 'f' },
    });
  });

  it('SHOULD leave the sale alone WHEN its quantity already matches the fraction', async () => {
    operationFindMany.mockResolvedValue([
      buy('a', '2026-01-10', '3155', 319100),
      reverse('e', '2026-03-10'),
      sale('f', '2026-04-04', 'e', '0.5'),
    ]);

    await assertPositionValid(tx, 'asset-1');

    expect(operationUpdate).not.toHaveBeenCalled();
  });
});

describe('recomputeEventSuggestions', () => {
  function pending(quantity: string) {
    return {
      event: { record_date: new Date('2026-11-18T00:00:00Z') },
      id: 'sug-1',
      quantity: new Prisma.Decimal(quantity),
    };
  }

  it('SHOULD read no operations WHEN nothing is pending', async () => {
    suggestionFindMany.mockResolvedValue([]);

    await recomputeEventSuggestions(tx, 'asset-1');

    expect(operationFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD follow the position at the data-com, ignoring later operations', async () => {
    suggestionFindMany.mockResolvedValue([pending('300')]);
    operationFindMany.mockResolvedValue([
      buy('a', '2026-01-10', '300'),
      buy('b', '2026-11-18', '100'),
      buy('c', '2026-11-19', '500'),
    ]);

    await recomputeEventSuggestions(tx, 'asset-1');

    expect(suggestionUpdate).toHaveBeenCalledWith({
      data: { quantity: '400.00000000' },
      where: { id: 'sug-1' },
    });
  });

  it('SHOULD drop the suggestion WHEN the position at the data-com is zero', async () => {
    suggestionFindMany.mockResolvedValue([pending('300')]);
    operationFindMany.mockResolvedValue([buy('a', '2026-12-10', '300')]);

    await recomputeEventSuggestions(tx, 'asset-1');

    expect(suggestionDelete).toHaveBeenCalledWith({ where: { id: 'sug-1' } });
  });
});
