import { UnprocessableEntityException } from '@nestjs/common';

import { scenario, setup, spies } from './index.mocks';

const base = {
  accessibleOwners: scenario.owners,
  amountPerUnit: '1.10',
  assetId: scenario.asset.id,
  exDateOffsetDays: 8,
  firstPaymentDate: '2025-01-15',
  frequency: { interval: 1, unit: 'MONTH' as never },
  type: 'YIELD' as never,
  withFinance: false,
};

it('SHOULD count the past ones, the one of this month AND the next projected dates, writing nothing', async () => {
  const preview = await setup.execute(base);

  expect(preview).toEqual({
    endsByPosition: null,
    firstNetAmount: 11000,
    firstQuantity: '100',
    next: ['2026-12-15', '2027-01-15', '2027-02-15'],
    occurrences: { currentMonth: 1, max: 600, past: 22 },
  });
  expect(spies.series.createSeries).not.toHaveBeenCalled();
});

it('SHOULD answer the count WHEN it is above the limit, so the form can disable the save', async () => {
  const preview = await setup.execute({
    ...base,
    exDateOffsetDays: null,
    firstPaymentDate: '2024-12-02',
    frequency: { interval: 1, unit: 'DAY' as never },
  });

  expect(preview.occurrences).toEqual({ currentMonth: 0, max: 600, past: 729 });
  expect(preview.firstNetAmount).toBeNull();
});

it('SHOULD answer 422 WHEN the first occurrence has no position OR the interval is out of range', async () => {
  await expect(setup.execute({ ...base, firstPaymentDate: '2024-06-15' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
  await expect(
    setup.execute({ ...base, frequency: { interval: 0, unit: 'MONTH' as never } }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});
