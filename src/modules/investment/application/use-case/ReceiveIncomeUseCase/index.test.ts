import { ConflictException } from '@nestjs/common';

import { incomeFixture } from '@investment/domain/entity/mocks/income.fixture';

import { scenario, setup, spies } from './index.mocks';

const planned = incomeFixture({
  assetId: scenario.asset.id,
  netAmount: 7140,
  paid: false,
  paymentDate: '2026-12-19',
});
const base = { accessibleOwners: scenario.owners, id: planned.id, userId: 'user-1' };

beforeEach(() => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(planned).mockResolvedValue(scenario.income);
  jest.useFakeTimers().setSystemTime(new Date('2026-11-04T15:00:00Z'));
});
afterEach(() => jest.useRealTimers());

it('SHOULD receive today with the planned value WHEN the body is empty', async () => {
  const view = await setup.execute(base);

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      incomeId: planned.id,
      netAmount: 7140,
      paid: true,
      paymentDate: '2026-11-04',
    }),
  );
  expect(view.status).toBe('RECEIVED');
});

it('SHOULD take the net amount, the date AND the account of the body', async () => {
  await setup.execute({
    ...base,
    accountId: 'acc-1',
    netAmount: 7215,
    receivedOn: '2026-11-03',
  });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: 'acc-1', netAmount: 7215, paymentDate: '2026-11-03' }),
  );
});

it('SHOULD answer 409 ALREADY_RECEIVED for a received income', async () => {
  spies.incomes.findIncomeById.mockReset();
  spies.incomes.findIncomeById.mockResolvedValue(scenario.income);

  await expect(setup.execute(base)).rejects.toBeInstanceOf(ConflictException);
  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'ALREADY_RECEIVED' },
  });
  expect(spies.incomes.writeIncome).not.toHaveBeenCalled();
});
