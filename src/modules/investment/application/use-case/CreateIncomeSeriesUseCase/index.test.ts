import { UnprocessableEntityException } from '@nestjs/common';

import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { IncomeSeriesEndReason, InvestmentOperationType } from '@investment/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { Decimal8 } from '@shared/infra/decimal';

import { scenario, setup, spies } from './index.mocks';

const base = {
  accessibleOwners: scenario.owners,
  accountId: 'acc-1',
  amountPerUnit: '1.10',
  assetId: scenario.asset.id,
  categoryId: 'cat-1',
  exDateOffsetDays: 8,
  firstPaymentDate: '2025-01-15',
  frequency: { interval: 1, unit: 'MONTH' as never },
  type: 'YIELD' as never,
  userId: 'user-1',
};

async function failure(input: object): Promise<unknown> {
  return setup.execute(input as never).catch((error: unknown) => error);
}

it('SHOULD create 22 received incomes and the planned one of this month in one call (spec 115 FR 14-15)', async () => {
  const result = await setup.execute(base);
  const params = spies.series.createSeries.mock.calls[0][0];

  expect(params.occurrences).toHaveLength(23);
  expect(
    params.occurrences.slice(0, 22).every((item: { received: boolean }) => item.received),
  ).toBe(true);
  expect(params.occurrences[22]).toEqual({
    exDate: '2026-11-07',
    netAmount: 11000,
    number: 23,
    paymentDate: '2026-11-15',
    quantity: '100',
    received: false,
  });
  expect(params.series).toMatchObject({
    accountId: 'acc-1',
    assetId: scenario.asset.id,
    endedAt: null,
    lastGeneratedNumber: 23,
    withFinance: true,
  });
  expect(params.assetLabel).toBe('HGLG11');
  expect(result.created).toEqual({ planned: 1, received: 22 });
  expect(result.nextPaymentDate).toBe('2026-12-15');
  expect(spies.gate.invalidate).toHaveBeenCalledWith(['user-1']);
});

it('SHOULD leave the past ones planned WHEN markPastAsReceived is off', async () => {
  const result = await setup.execute({ ...base, markPastAsReceived: false });

  expect(result.created).toEqual({ planned: 23, received: 0 });
});

it('SHOULD use the position of each ex-date for the amount (spec 115 FR 10)', async () => {
  spies.investment.findAssetById.mockResolvedValue({
    ...scenario.detail,
    operations: [
      scenario.buy,
      operationFixture({
        assetId: scenario.asset.id,
        date: '2025-06-01',
        quantity: Decimal8.parse('20'),
        type: InvestmentOperationType.BUY,
      }),
    ],
  });

  await setup.execute(base);

  const amounts = spies.series.createSeries.mock.calls[0][0].occurrences.map(
    (item: { netAmount: number }) => item.netAmount,
  );

  expect(amounts[0]).toBe(11000);
  expect(amounts[5]).toBe(13200);
});

it('SHOULD end the series by itself WHEN the position reaches zero (spec 115 FR 11)', async () => {
  spies.investment.findAssetById.mockResolvedValue({
    ...scenario.detail,
    operations: [
      scenario.buy,
      operationFixture({
        assetId: scenario.asset.id,
        date: '2025-06-20',
        quantity: Decimal8.parse('100'),
        type: InvestmentOperationType.SELL,
      }),
    ],
  });

  const result = await setup.execute(base);
  const params = spies.series.createSeries.mock.calls[0][0];

  expect(params.occurrences).toHaveLength(6);
  expect(params.series).toMatchObject({
    endedAt: '2025-07-15',
    endReason: IncomeSeriesEndReason.POSITION_ZERO,
    lastGeneratedNumber: 6,
  });
  expect(result.created.received).toBe(6);
});

it('SHOULD end the series by its end date once every occurrence exists', async () => {
  await setup.execute({ ...base, endDate: '2025-03-20' });

  expect(spies.series.createSeries.mock.calls[0][0].series).toMatchObject({
    endedAt: '2025-03-20',
    endReason: IncomeSeriesEndReason.END_DATE,
    lastGeneratedNumber: 3,
  });
});

it('SHOULD answer 422 NO_POSITION_AT_START with the first buy date (spec 115 FR 12)', async () => {
  const error = (await failure({
    ...base,
    firstPaymentDate: '2024-06-15',
  })) as UnprocessableEntityException;

  expect(error).toBeInstanceOf(UnprocessableEntityException);
  expect(error.getResponse()).toMatchObject({
    code: 'NO_POSITION_AT_START',
    details: { firstBuyDate: '2024-12-01' },
  });
  expect(spies.series.createSeries).not.toHaveBeenCalled();
});

it('SHOULD answer 422 TOO_MANY_OCCURRENCES above 600 with the count (spec 115 FR 16)', async () => {
  const error = (await failure({
    ...base,
    exDateOffsetDays: null,
    firstPaymentDate: '2024-12-02',
    frequency: { interval: 1, unit: 'DAY' },
  })) as UnprocessableEntityException;

  expect(error.getResponse()).toMatchObject({
    code: 'TOO_MANY_OCCURRENCES',
    details: { count: 729, max: 600 },
  });
});

it('SHOULD answer 422 WHEN the interval is out of the range of its unit', async () => {
  expect(await failure({ ...base, frequency: { interval: 25, unit: 'MONTH' } })).toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD create a series without finance: no account, no category (spec 115 FR 1)', async () => {
  const { accountId, categoryId, ...rest } = base;

  void accountId;
  void categoryId;
  await setup.execute({ ...rest, withFinance: false });

  expect(spies.investment.findAccountForOperation).not.toHaveBeenCalled();
  expect(spies.series.createSeries.mock.calls[0][0].series).toMatchObject({
    accountId: null,
    categoryId: null,
    withFinance: false,
  });
});

it('SHOULD answer 400 WHEN the account and category do not match withFinance', async () => {
  expect(await failure({ ...base, withFinance: false })).toBeInstanceOf(ValidationError);
  expect(await failure({ ...base, accountId: undefined })).toBeInstanceOf(ValidationError);
  expect(await failure({ ...base, endDate: '2024-01-01' })).toBeInstanceOf(ValidationError);
});

it('SHOULD check the account and the category WHEN in finance', async () => {
  spies.investment.findAccountForOperation.mockResolvedValue({
    ...scenario.account,
    currency: 'USD',
  });

  expect(await failure(base)).toBeInstanceOf(UnprocessableEntityException);
});
