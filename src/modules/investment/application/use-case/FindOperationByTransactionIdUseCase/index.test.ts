import { setup, spies } from './index.mocks';

it('SHOULD find the operation linked to a finance row', async () => {
  spies.findOperationByTransactionId.mockResolvedValue({ assetId: 'a', operationId: 'o' });

  expect(await setup.execute({ transactionId: 'tx' })).toEqual({ assetId: 'a', operationId: 'o' });
  expect(spies.findOperationByTransactionId).toHaveBeenCalledWith('tx');
});

it('SHOULD return undefined for a row that is not an investment', async () => {
  spies.findOperationByTransactionId.mockResolvedValue(undefined);

  expect(await setup.execute({ transactionId: 'tx' })).toBeUndefined();
});
