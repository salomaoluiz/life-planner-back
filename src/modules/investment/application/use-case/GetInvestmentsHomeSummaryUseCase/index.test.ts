import { ForbiddenException } from '@nestjs/common';

import { emptyContext, QuoteContext, quoteKey } from '@investment/application/service/QuoteContext';
import {
  assetFixture,
  fixedIncomeDataFixture,
  fixedIncomeTermsFixture,
  listRowFixture,
  operationFixture,
  quoteFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { incomeSpies, mocks, quoteSpies, setup, spies } from './index.mocks';

const now = new Date('2026-11-04T18:00:00Z');
const input = { accessibleOwners: mocks.owners, ownerIds: ['user-1'], today: mocks.today };

function cdb(name: string, maturityDate: string) {
  const asset = assetFixture({ assetClass: InvestmentAssetClass.FIXED_INCOME, name, ticker: null });
  const lot = operationFixture({
    assetId: asset.id,
    date: '2026-01-02',
    quantity: Decimal8.parse('10000'),
    total: 1_000_000,
    unitPrice: Decimal8.parse('1'),
  });
  const data = fixedIncomeDataFixture({
    terms: fixedIncomeTermsFixture({ assetId: asset.id, maturityDate }),
  });

  return { data, row: listRowFixture({ ...asset, operations: [lot] }) };
}
function context(overrides: Partial<QuoteContext> = {}): QuoteContext {
  return {
    ...emptyContext(now),
    quotes: new Map([[quoteKey('B3', 'ITSA4'), quoteFixture()]]),
    ...overrides,
  };
}
function stock() {
  const asset = assetFixture({ ticker: 'ITSA4' });
  const buy = operationFixture({
    assetId: asset.id,
    quantity: Decimal8.parse('100'),
    total: 100000,
    unitPrice: Decimal8.parse('10'),
  });

  return listRowFixture({ ...asset, operations: [buy] });
}

it('SHOULD sum a listed stock at the quote and a calculated title at the estimated net', async () => {
  const title = cdb('CDB', '2026-12-15');
  spies.findAssetsByOwners.mockResolvedValue([stock(), title.row]);
  quoteSpies.load.mockResolvedValue(
    context({ fixedIncome: new Map([[title.row.id, title.data]]) }),
  );

  const summary = await setup.execute(input);

  expect(summary).toMatchObject({
    currency: 'BRL',
    hasPositions: true,
    investedCents: 1_100_000,
    nextMaturity: { maturityDate: '2026-12-15', name: 'CDB' },
    quotes: {
      asOf: new Date('2026-11-04T16:00:00Z'),
      manualCount: 0,
      stale: false,
      withoutPrice: 0,
    },
  });
  expect(summary.currentValueCents).toBeGreaterThan(1_100_000);
  expect(summary.resultCents).toBe(summary.currentValueCents - summary.investedCents);
  expect(summary.resultBasisPoints).toBe(
    Math.round((summary.resultCents / summary.investedCents) * 10000),
  );
});

it('SHOULD read the assets of the requested owners only, active ones', async () => {
  spies.findAssetsByOwners.mockResolvedValue([]);

  await setup.execute({ ...input, ownerIds: ['user-1', 'fam'] });

  expect(spies.findAssetsByOwners).toHaveBeenCalledWith(
    [mocks.owners[0], mocks.owners[2]],
    'ACTIVE',
  );
});

it('SHOULD include an archived family WHEN its id is requested explicitly', async () => {
  spies.findAssetsByOwners.mockResolvedValue([]);

  await setup.execute({ ...input, ownerIds: ['fam-archived'] });

  expect(spies.findAssetsByOwners).toHaveBeenCalledWith([mocks.owners[1]], 'ACTIVE');
});

it('SHOULD throw 403 WHEN any requested owner is not accessible', async () => {
  await expect(setup.execute({ ...input, ownerIds: ['user-1', 'stranger'] })).rejects.toThrow(
    ForbiddenException,
  );
  expect(spies.findAssetsByOwners).not.toHaveBeenCalled();
});

it('SHOULD answer zeros WITHOUT reading quotes or incomes WHEN the owner has no assets', async () => {
  spies.findAssetsByOwners.mockResolvedValue([]);

  expect(await setup.execute(input)).toEqual({
    currency: 'BRL',
    currentValueCents: 0,
    hasPositions: false,
    income: { count: 0, month: '2026-11', pendingSuggestions: 0, totalCents: 0 },
    investedCents: 0,
    nextMaturity: null,
    quotes: { asOf: null, manualCount: 0, stale: false, withoutPrice: 0 },
    resultBasisPoints: null,
    resultCents: 0,
  });
  expect(quoteSpies.load).not.toHaveBeenCalled();
  expect(incomeSpies.findReceivedByOwners).not.toHaveBeenCalled();
});

it('SHOULD not count a closed position AND report no positions', async () => {
  const closed = listRowFixture({ operations: [] });
  spies.findAssetsByOwners.mockResolvedValue([closed]);
  quoteSpies.load.mockResolvedValue(context());

  expect(await setup.execute(input)).toMatchObject({ currentValueCents: 0, hasPositions: false });
});

it('SHOULD count an asset with no price at its cost AND say so', async () => {
  spies.findAssetsByOwners.mockResolvedValue([stock()]);
  quoteSpies.load.mockResolvedValue(context({ quotes: new Map() }));

  expect(await setup.execute(input)).toMatchObject({
    currentValueCents: 100000,
    quotes: { asOf: null, withoutPrice: 1 },
    resultCents: 0,
  });
});

it('SHOULD flag stale WHEN the stored quote is old', async () => {
  spies.findAssetsByOwners.mockResolvedValue([stock()]);
  quoteSpies.load.mockResolvedValue(
    context({
      quotes: new Map([
        [quoteKey('B3', 'ITSA4'), quoteFixture({ quotedAt: new Date('2026-10-01T16:00:00Z') })],
      ]),
    }),
  );

  expect((await setup.execute(input)).quotes.stale).toBe(true);
});

it('SHOULD sum the received income of the month, USD at the current rate, AND count the pending suggestions', async () => {
  const row = stock();
  spies.findAssetsByOwners.mockResolvedValue([row]);
  quoteSpies.load.mockResolvedValue(
    context({ fx: { pair: 'USD-BRL', quotedAt: now, rate: '5.5', source: 'BRAPI' } }),
  );
  incomeSpies.findReceivedByOwners.mockResolvedValue([
    { currency: 'BRL', netAmount: 100000 },
    { currency: 'USD', netAmount: 1000 },
  ]);
  incomeSpies.countPendingSuggestionsByAssets.mockResolvedValue(2);

  const { income } = await setup.execute({ ...input, today: '2026-02-10' });

  expect(income).toEqual({ count: 2, month: '2026-02', pendingSuggestions: 2, totalCents: 105500 });
  expect(incomeSpies.findReceivedByOwners).toHaveBeenCalledWith(
    [mocks.owners[0]],
    '2026-02-01',
    '2026-02-28',
  );
  expect(incomeSpies.countPendingSuggestionsByAssets).toHaveBeenCalledWith([row.id]);
});

it('SHOULD pick the month boundaries on the first and last day', async () => {
  spies.findAssetsByOwners.mockResolvedValue([stock()]);
  quoteSpies.load.mockResolvedValue(context());

  await setup.execute({ ...input, today: '2026-12-31' });
  await setup.execute({ ...input, today: '2028-02-01' });

  expect(incomeSpies.findReceivedByOwners).toHaveBeenNthCalledWith(
    1,
    expect.anything(),
    '2026-12-01',
    '2026-12-31',
  );
  expect(incomeSpies.findReceivedByOwners).toHaveBeenNthCalledWith(
    2,
    expect.anything(),
    '2028-02-01',
    '2028-02-29',
  );
});

it('SHOULD reject an invalid today or an empty owner list', async () => {
  await expect(setup.execute({ ...input, today: '04/11/2026' })).rejects.toThrow();
  await expect(setup.execute({ ...input, ownerIds: [] })).rejects.toThrow();
});
