import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { IncomeSeriesEndReason } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: scenario.series.id, userId: 'user-1' };

it('SHOULD change the amount per unit of the series AND of every planned occurrence (spec 115 FR 24 ALL)', async () => {
  spies.series.findPlannedFrom.mockResolvedValue([
    { exDate: '2026-11-07', id: 'inc-1', number: 23, paymentDate: '2026-11-15', quantity: '120' },
  ]);

  const view = await setup.execute({ ...base, amountPerUnit: '1.5', notes: ' nota ' });

  expect(spies.series.updateSeries).toHaveBeenCalledWith({
    assetLabel: 'HGLG11',
    patch: expect.objectContaining({
      accountId: 'acc-1',
      amountPerUnit: '1.5',
      categoryId: 'cat-1',
      notes: 'nota',
      withFinance: true,
    }),
    planned: [
      {
        amountPerUnit: '1.5',
        exDate: '2026-11-07',
        incomeId: 'inc-1',
        netAmount: 18000,
        quantity: '120',
      },
    ],
    seriesId: scenario.series.id,
  });
  expect(view.series).toBe(scenario.series);
  expect(spies.gate.invalidate).toHaveBeenCalledWith(['user-1']);
});

it('SHOULD switch the series to no finance AND require account and category to switch back', async () => {
  await setup.execute({ ...base, withFinance: false });

  expect(spies.series.updateSeries.mock.calls[0][0].patch).toMatchObject({
    accountId: null,
    categoryId: null,
    withFinance: false,
  });

  spies.series.findById.mockResolvedValue({
    ...scenario.series,
    accountId: null,
    categoryId: null,
    withFinance: false,
  });

  await expect(setup.execute({ ...base, withFinance: true })).rejects.toMatchObject({
    response: { code: 'INCOME_INCOMPLETE', missing: ['accountId', 'categoryId'] },
  });
  await expect(setup.execute({ ...base, accountId: 'acc-1' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD reopen a series ended by its end date from the next number (spec 115 FR 26)', async () => {
  spies.series.findById.mockResolvedValueOnce({
    ...scenario.series,
    endDate: '2026-11-30',
    endedAt: '2026-11-30',
    endReason: IncomeSeriesEndReason.END_DATE,
  });

  await setup.execute({ ...base, endDate: null });

  expect(spies.series.updateSeries.mock.calls[0][0].patch).toMatchObject({
    endDate: null,
    endedAt: null,
    endReason: null,
  });
  expect(spies.series.materialize).toHaveBeenCalledWith(
    expect.objectContaining({ lastGeneratedNumber: 23, occurrences: [] }),
  );
});

it('SHOULD answer 422 WHEN the next occurrence of a reopened series has no position (spec 115 FR 26)', async () => {
  spies.investment.findAssetById.mockResolvedValue({ ...scenario.detail, operations: [] });
  spies.series.findById.mockResolvedValueOnce({
    ...scenario.series,
    endedAt: '2026-11-30',
    endReason: IncomeSeriesEndReason.POSITION_ZERO,
    lastGeneratedNumber: 22,
  });

  await expect(setup.execute({ ...base, endDate: null })).rejects.toMatchObject({
    response: { code: 'NO_POSITION_AT_START' },
  });
  expect(spies.series.updateSeries).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for an unknown series AND 422 for an end date before the first payment', async () => {
  spies.series.findById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
  await expect(setup.execute({ ...base, endDate: '2024-01-01' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD answer 404 WHEN the series cannot be read after the update', async () => {
  spies.series.findById.mockResolvedValueOnce(scenario.series).mockResolvedValueOnce(undefined);

  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});
