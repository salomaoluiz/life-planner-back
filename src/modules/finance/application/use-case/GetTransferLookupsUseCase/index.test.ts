import { mocks, setup, spies } from './index.mocks';

it('SHOULD return the full transfer AND both accounts WHEN the caller can read both sides', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    transferIds: ['transfer-1', 'transfer-1'],
  });

  expect(spies.transferRepository.findTransfersByIds).toHaveBeenCalledWith(['transfer-1']);
  expect(result.accounts).toEqual([mocks.fromAccount, mocks.toAccount]);
  expect(result.transfers).toEqual([
    {
      amountIn: 92000,
      amountOut: 500000,
      counterpartHidden: false,
      currencyIn: 'USD',
      currencyOut: 'BRL',
      dateIn: '2026-11-04',
      dateOut: '2026-11-04',
      feeRowId: 'row-fee',
      fromAccountId: 'acc-from',
      id: 'transfer-1',
      recurrenceId: 'series-1',
      toAccountId: 'acc-to',
    },
  ]);
});

it('SHOULD hide the destination, its amount and the fee WHEN the caller reads only the origin', async () => {
  const result = await setup.execute({
    accessibleOwners: [mocks.accessibleOwners[0]],
    transferIds: ['transfer-1'],
  });

  expect(result.accounts).toEqual([mocks.fromAccount]);
  expect(result.transfers[0]).toMatchObject({
    amountIn: null,
    amountOut: 500000,
    counterpartHidden: true,
    feeRowId: null,
    fromAccountId: 'acc-from',
    toAccountId: null,
  });
});

it('SHOULD hide the origin AND its amount WHEN the caller reads only the destination', async () => {
  const result = await setup.execute({
    accessibleOwners: [mocks.accessibleOwners[1]],
    transferIds: ['transfer-1'],
  });

  expect(result.accounts).toEqual([mocks.toAccount]);
  expect(result.transfers[0]).toMatchObject({
    amountIn: 92000,
    amountOut: null,
    counterpartHidden: true,
    feeRowId: 'row-fee',
    fromAccountId: null,
    toAccountId: 'acc-to',
  });
});

it('SHOULD not hide anything for a removed account (null id) AND skip the reads WHEN there are no ids', async () => {
  spies.transferRepository.findTransfersByIds.mockResolvedValueOnce([{ ...mocks.transfer, toAccountId: null }]);

  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    transferIds: ['transfer-1'],
  });

  expect(result.transfers[0]).toMatchObject({ counterpartHidden: false, toAccountId: null });

  spies.transferRepository.findTransfersByIds.mockClear();
  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, transferIds: [] })).toEqual({
    accounts: [],
    transfers: [],
  });
  expect(spies.transferRepository.findTransfersByIds).not.toHaveBeenCalled();
});
