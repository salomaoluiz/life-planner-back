import { scenario, setup, spies } from './index.mocks';

it('SHOULD answer the asset and income behind a finance row, or undefined', async () => {
  spies.incomes.findIncomeByTransactionId.mockResolvedValueOnce({
    assetId: scenario.asset.id,
    incomeId: scenario.income.id,
  });

  expect(await setup.execute({ transactionId: 'tx-1' })).toEqual({
    assetId: scenario.asset.id,
    incomeId: scenario.income.id,
  });

  spies.incomes.findIncomeByTransactionId.mockResolvedValueOnce(undefined);

  expect(await setup.execute({ transactionId: 'tx-2' })).toBeUndefined();
});
