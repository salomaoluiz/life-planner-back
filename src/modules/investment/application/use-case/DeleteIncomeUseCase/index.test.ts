import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { InvestmentAssetStatus } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: scenario.income.id };

it('SHOULD delete the income', async () => {
  await setup.execute(base);

  expect(spies.incomes.deleteIncome).toHaveBeenCalledWith(scenario.income.id);
});

it('SHOULD answer 404 for an unknown income', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived asset AND 403 WHEN the account is out of reach', async () => {
  spies.investment.findAssetById.mockResolvedValueOnce(scenario.detail).mockResolvedValueOnce({
    ...scenario.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(UnprocessableEntityException);

  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    ownerId: 'left-user',
  });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(ForbiddenException);
  expect(spies.incomes.deleteIncome).not.toHaveBeenCalled();
});

it('SHOULD delete an income whose finance row is gone (no account)', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce({ ...scenario.income, accountId: null });

  await setup.execute(base);

  expect(spies.incomes.deleteIncome).toHaveBeenCalled();
});

describe('income of a series (spec 115 FR 25)', () => {
  const seriesIncome = { ...scenario.income, occurrenceNumber: 24, seriesId: 'series-1' };
  const base = { accessibleOwners: scenario.owners, id: scenario.income.id };

  beforeEach(() => {
    spies.incomes.findIncomeById.mockResolvedValue(seriesIncome);
  });

  it('SHOULD answer 400 WHEN no scope is given', async () => {
    await expect(setup.execute(base)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SHOULD delete only this occurrence with ONLY_THIS', async () => {
    await setup.execute({ ...base, scope: 'ONLY_THIS' });

    expect(spies.incomes.deleteIncome).toHaveBeenCalledWith(scenario.income.id);
    expect(spies.gate.invalidate).toHaveBeenCalledWith(['user-1']);
  });

  it('SHOULD end the series AND delete the planned ones from here with THIS_AND_NEXT', async () => {
    await setup.execute({ ...base, scope: 'THIS_AND_NEXT' });

    expect(spies.series.endSeries).toHaveBeenCalledWith({
      deleteFromNumber: 24,
      endedAt: seriesIncome.paymentDate,
      endReason: 'MANUAL',
      id: 'series-1',
    });
  });

  it('SHOULD delete the whole series with ALL', async () => {
    await setup.execute({ ...base, scope: 'ALL' });

    expect(spies.series.deleteSeries).toHaveBeenCalledWith('series-1');
  });
});
