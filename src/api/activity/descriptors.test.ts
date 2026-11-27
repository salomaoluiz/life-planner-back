import { ActivityGroupKind } from '@activity/domain/enum';

import { ActivityContext } from './ActivityRecorder';
import {
  adjustmentKey,
  fromParam,
  fromResponse,
  importGroup,
  importOwnerKey,
  incomeSeriesGroup,
  invoiceKey,
  planKey,
  purchasePostingGroup,
  rateKey,
  scopeOf,
  seriesGroup,
  seriesScopeGroup,
  valuationKey,
  wholeGroup,
} from './descriptors';

function context(overrides: Partial<ActivityContext> = {}): ActivityContext {
  return {
    body: undefined,
    params: {},
    query: {},
    response: undefined,
    startedAt: new Date('2026-11-27T12:00:10.000Z'),
    userId: 'u-1',
    ...overrides,
  };
}
const before = {
  refs: { installmentPlanId: null, recurrenceId: 'r-1' },
} as never;

describe('ids', () => {
  it('SHOULD read a dotted path of the response AND ignore a missing or non-string value', () => {
    const read = fromResponse('item.id');

    expect(read(context({ response: { item: { id: 'x' } } }))).toBe('x');
    expect(read(context({ response: { item: {} } }))).toBeUndefined();
    expect(read(context())).toBeUndefined();
    expect(fromResponse('n')(context({ response: { n: 5 } }))).toBeUndefined();
  });

  it('SHOULD read ids from the path AND build the composite keys', () => {
    const params = { earlyPaymentId: 'e-1', id: 'card-1', month: '2026-11' };

    expect(fromParam('earlyPaymentId')(context({ params }))).toBe('e-1');
    expect(invoiceKey(context({ params }))).toBe('card-1:2026-11');
    expect(planKey(context({ params }))).toBe('plan:card-1');
  });
});

describe('scope', () => {
  it('SHOULD take the scope from the body, else from the query', () => {
    expect(scopeOf(context({ body: { scope: 'ALL' } }))).toBe('ALL');
    expect(scopeOf(context({ query: { scope: 'THIS_AND_NEXT' } }))).toBe('THIS_AND_NEXT');
    expect(scopeOf(context({ body: { scope: 1 } }))).toBeUndefined();
  });

  it('SHOULD group the series rows only WHEN the scope reaches beyond this row', () => {
    expect(seriesGroup(context({ body: { scope: 'ALL' } }), before)).toEqual({
      id: 'r-1',
      kind: ActivityGroupKind.RECURRENCE_ROWS,
    });
    expect(seriesGroup(context({ body: { scope: 'ONLY_THIS' } }), before)).toBeUndefined();
    expect(seriesGroup(context(), before)).toBeUndefined();
    expect(seriesGroup(context({ query: { scope: 'ALL' } }), null)).toBeUndefined();
  });

  it('SHOULD group an installment plan WHEN the row has no recurrence', () => {
    expect(
      seriesGroup(context({ query: { scope: 'ALL' } }), {
        refs: { installmentPlanId: 'p-1', recurrenceId: null },
      } as never),
    ).toEqual({ id: 'p-1', kind: ActivityGroupKind.INSTALLMENT_PLAN_ROWS });
  });

  it('SHOULD group by the route id WHEN the scope reaches beyond this occurrence', () => {
    const group = seriesScopeGroup(ActivityGroupKind.RECURRENCE_ROWS);

    expect(group(context({ params: { id: 'r-9' }, query: { scope: 'ALL' } }), null)).toEqual({
      id: 'r-9',
      kind: 'RECURRENCE_ROWS',
    });
    expect(group(context({ query: { scope: 'ONLY_THIS' } }), null)).toBeUndefined();
  });

  it('SHOULD always group the rows of a whole series', () => {
    expect(
      wholeGroup(ActivityGroupKind.SPLIT_ROWS, fromParam('id'))(
        context({ params: { id: 's' } }),
        null,
      ),
    ).toEqual({ id: 's', kind: 'SPLIT_ROWS' });
  });
});

describe('import', () => {
  it('SHOULD key the import by the family, else by the user', () => {
    expect(importOwnerKey(context({ body: { owner: 'FAMILY', ownerId: 'f-1' } }))).toBe(
      'FAMILY|f-1',
    );
    expect(importOwnerKey(context({ body: { owner: 'ALL' } }))).toBe('USER|u-1');
  });

  it('SHOULD look 10 seconds before the start of the request', () => {
    expect(importGroup(context({ body: { owner: 'USER' } }))).toEqual({
      id: 'USER|u-1|2026-11-27T12:00:00.000Z',
      kind: 'CREATED_SINCE',
    });
  });
});

describe('investment keys and groups', () => {
  it('SHOULD build the valuation, rate and adjustment keys, preferring the known title', () => {
    const params = { date: '2026-10-01', id: 'a-1' };

    expect(valuationKey(context({ params }))).toBe('a-1:2026-10-01');
    expect(rateKey(context({ params }), null)).toBe('rate:a-1');
    expect(adjustmentKey(context({ params }), null)).toBe('adjustment:a-1');
    expect(rateKey(context({ params }), { entityId: 'asset-9' } as never)).toBe('asset-9');
    expect(adjustmentKey(context({ params }), { entityId: 'asset-9' } as never)).toBe('asset-9');
  });

  it('SHOULD group the incomes of a series only WHEN the scope reaches beyond this one', () => {
    const income = { refs: { seriesId: 's-1' } } as never;

    expect(incomeSeriesGroup(context({ body: { scope: 'ALL' } }), income)).toEqual({
      id: 's-1',
      kind: 'INCOME_SERIES_ROWS',
    });
    expect(incomeSeriesGroup(context({ body: { scope: 'ONLY_THIS' } }), income)).toBeUndefined();
    expect(
      incomeSeriesGroup(context({ body: { scope: 'ALL' } }), { refs: {} } as never),
    ).toBeUndefined();
  });

  it('SHOULD find the rows a stock purchase close posted', () => {
    expect(purchasePostingGroup(context({ response: { splitId: 's-1' } }))).toEqual({
      id: 's-1',
      kind: 'SPLIT_ROWS',
    });
    expect(purchasePostingGroup(context({ response: { transactionId: 't-1' } }))).toEqual({
      id: 't-1',
      kind: 'TRANSACTION_IDS',
    });
    expect(purchasePostingGroup(context())).toEqual({ id: undefined, kind: 'TRANSACTION_IDS' });
  });
});
