import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { incomeFixture, incomeSeriesFixture } from '@investment/domain/entity/mocks/income.fixture';
import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: scenario.income.id, userId: 'user-1' };

it('SHOULD keep every stored field WHEN the body is empty AND rewrite the same income', async () => {
  await setup.execute(base);

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      amountPerUnit: '0.28',
      categoryId: 'cat-1',
      exDate: '2026-09-10',
      incomeId: scenario.income.id,
      netAmount: 7140,
      paid: true,
      paymentDate: '2026-10-30',
      quantity: '300',
      type: InvestmentIncomeType.JCP,
    }),
  );
});

it('SHOULD apply every field of the body, including clearing the optional ones', async () => {
  await setup.execute({
    ...base,
    accountId: 'acc-2',
    amountPerUnit: null,
    categoryId: 'cat-1',
    exDate: null,
    netAmount: 9000,
    notes: null,
    paymentDate: '2026-11-01',
    quantity: '10',
    status: 'PLANNED',
    type: InvestmentIncomeType.DIVIDEND,
  });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-2',
      amountPerUnit: null,
      exDate: null,
      netAmount: 9000,
      notes: null,
      paid: false,
      paymentDate: '2026-11-01',
      quantity: '10',
      type: InvestmentIncomeType.DIVIDEND,
    }),
  );
});

it('SHOULD validate the new account (currency)', async () => {
  spies.investment.findAccountForOperation.mockResolvedValue({
    ...scenario.account,
    currency: 'USD',
  });

  await expect(setup.execute({ ...base, accountId: 'acc-2' })).rejects.toMatchObject({
    response: { code: 'CURRENCY_MISMATCH' },
  });
});

it('SHOULD answer 404 for an unknown income OR an asset out of reach', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValueOnce({ ...scenario.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 403 WHEN the current account of the income is out of the caller reach', async () => {
  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    ownerId: 'left-user',
  });

  await expect(setup.execute(base)).rejects.toBeInstanceOf(ForbiddenException);
  expect(spies.incomes.writeIncome).not.toHaveBeenCalled();
});

it('SHOULD answer 422 INCOME_INCOMPLETE WHEN the finance row lost its account or category', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(
    incomeFixture({ accountId: null, assetId: scenario.asset.id, categoryId: null }),
  );

  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'INCOME_INCOMPLETE', missing: ['accountId', 'categoryId'] },
  });
});

it('SHOULD let the owner pick the account and category of an income whose row lost them', async () => {
  spies.incomes.findIncomeById
    .mockResolvedValueOnce(
      incomeFixture({ accountId: null, assetId: scenario.asset.id, categoryId: null }),
    )
    .mockResolvedValue(scenario.income);

  await setup.execute({ ...base, accountId: 'acc-1', categoryId: 'cat-1' });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: 'acc-1', categoryId: 'cat-1' }),
  );
});

describe('income of a series (spec 115 FR 24)', () => {
  const seriesIncome = {
    ...scenario.income,
    occurrenceNumber: 24,
    paid: false,
    seriesId: 'series-1',
  };
  const series = incomeSeriesFixture({ id: 'series-1' });
  const base = { accessibleOwners: scenario.owners, id: scenario.income.id, userId: 'user-1' };
  const detail = {
    ...scenario.detail,
    assetClass: 'BR_REIT' as never,
    operations: [
      operationFixture({
        date: '2024-12-01',
        quantity: Decimal8.parse('100'),
        type: 'BUY' as never,
      }),
    ],
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-12T15:00:00Z') });
    spies.incomes.findIncomeById.mockResolvedValue(seriesIncome);
    spies.investment.findAssetById.mockResolvedValue(detail);
    spies.series.findById.mockResolvedValue(series);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('SHOULD answer 400 WITHOUT a scope, with series fields on a plain income OR with ONLY_THIS', async () => {
    await expect(setup.execute({ ...base, notes: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      setup.execute({
        ...base,
        frequency: { interval: 2, unit: 'MONTH' as never },
        scope: 'ONLY_THIS',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    spies.incomes.findIncomeById.mockResolvedValue(scenario.income);
    await expect(setup.execute({ ...base, endDate: '2027-01-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('SHOULD edit only this income and keep its number with ONLY_THIS', async () => {
    await setup.execute({ ...base, notes: 'só esta', scope: 'ONLY_THIS' });

    expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
      expect.objectContaining({ incomeId: scenario.income.id, notes: 'só esta' }),
    );
    expect(spies.series.splitSeries).not.toHaveBeenCalled();
  });

  it('SHOULD edit the series through its use case with ALL AND refuse the rule fields', async () => {
    await setup.execute({ ...base, amountPerUnit: '1.2', scope: 'ALL' });

    expect(spies.updateSeries.execute).toHaveBeenCalledWith(
      expect.objectContaining({ amountPerUnit: '1.2', id: 'series-1' }),
    );
    await expect(
      setup.execute({ ...base, exDateOffsetDays: 2, scope: 'ALL' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SHOULD split the series at this occurrence with the new values with THIS_AND_NEXT', async () => {
    spies.incomes.findIncomes.mockResolvedValue([{ ...scenario.income, seriesId: 'series-2' }]);
    spies.series.splitSeries.mockResolvedValue('series-2');

    await setup.execute({ ...base, amountPerUnit: '1.15', scope: 'THIS_AND_NEXT' });

    const call = spies.series.splitSeries.mock.calls[0][0];

    expect(call).toMatchObject({
      deleteFromNumber: 24,
      endedAt: seriesIncome.paymentDate,
      id: 'series-1',
    });
    expect(call.create.series).toMatchObject({
      amountPerUnit: '1.15',
      firstNumber: 24,
      firstPaymentDate: seriesIncome.paymentDate,
    });
    expect(spies.gate.invalidate).toHaveBeenCalledWith(['user-1']);
  });

  it('SHOULD start the new series at the next number WHEN this occurrence was already received', async () => {
    spies.incomes.findIncomeById.mockResolvedValue({
      ...seriesIncome,
      occurrenceNumber: 22,
      paid: true,
    });
    spies.incomes.findIncomes.mockResolvedValue([{ ...scenario.income, seriesId: 'series-2' }]);
    spies.series.splitSeries.mockResolvedValue('series-2');

    await setup.execute({ ...base, scope: 'THIS_AND_NEXT' });

    expect(spies.series.splitSeries.mock.calls[0][0].create.series).toMatchObject({
      firstNumber: 23,
      firstPaymentDate: '2026-11-15',
    });
  });

  it('SHOULD validate the rule, the account AND the position before splitting', async () => {
    await expect(
      setup.execute({
        ...base,
        frequency: { interval: 99, unit: 'MONTH' as never },
        scope: 'THIS_AND_NEXT',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      setup.execute({ ...base, accountId: 'acc-1', scope: 'THIS_AND_NEXT', withFinance: false }),
    ).rejects.toBeInstanceOf(BadRequestException);

    spies.investment.findAssetById.mockResolvedValue({ ...detail, operations: [] });
    await expect(setup.execute({ ...base, scope: 'THIS_AND_NEXT' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(spies.series.splitSeries).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the series OR the new income is gone', async () => {
    spies.series.findById.mockResolvedValueOnce(undefined);
    await expect(setup.execute({ ...base, scope: 'ALL' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    spies.series.splitSeries.mockResolvedValue('series-2');
    spies.incomes.findIncomes.mockResolvedValue([]);
    await expect(setup.execute({ ...base, scope: 'THIS_AND_NEXT' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('SHOULD reload the income after ALL AND answer 404 WHEN it is gone', async () => {
    spies.incomes.findIncomeById
      .mockResolvedValueOnce(seriesIncome)
      .mockResolvedValueOnce(undefined);

    await expect(setup.execute({ ...base, scope: 'ALL' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('withFinance (spec 115 FR 4)', () => {
  const lone = incomeFixture({
    accountId: null,
    assetId: scenario.asset.id,
    categoryId: null,
    transactionId: null,
    withFinance: false,
  });

  it('SHOULD turn finance off: no account, no category, the row goes away in the datasource', async () => {
    await setup.execute({ ...base, withFinance: false });

    expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: null, categoryId: null, withFinance: false }),
    );
  });

  it('SHOULD turn finance on WITH an account and a category AND refuse it without them', async () => {
    spies.incomes.findIncomeById.mockResolvedValue(lone);

    await setup.execute({ ...base, accountId: 'acc-1', categoryId: 'cat-1', withFinance: true });

    expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1', categoryId: 'cat-1', withFinance: true }),
    );
    await expect(setup.execute({ ...base, withFinance: true })).rejects.toMatchObject({
      response: { code: 'INCOME_INCOMPLETE' },
    });
  });

  it('SHOULD answer 400 WHEN an income without finance gets an account without switching it on', async () => {
    spies.incomes.findIncomeById.mockResolvedValue(lone);

    await expect(setup.execute({ ...base, accountId: 'acc-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
