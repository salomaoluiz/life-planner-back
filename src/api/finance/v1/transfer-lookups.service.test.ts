import { mocks, setup, spies } from './transfer-lookups.service.mocks';

const owners = [{ owner: 'USER' as never, ownerId: 'user-1' }];

it('SHOULD return the lookups untouched AND read nothing WHEN no row belongs to a transfer', async () => {
  const result = await setup.attach(owners, [mocks.plainRow as never], mocks.baseLookups);

  expect(result).toBe(mocks.baseLookups);
  expect(spies.getTransferLookups.execute).not.toHaveBeenCalled();
});

it('SHOULD add the transfers AND the readable counterpart account without replacing the existing accounts', async () => {
  const result = await setup.attach(owners, [mocks.transferRow as never], mocks.baseLookups);

  expect(spies.getTransferLookups.execute).toHaveBeenCalledWith({
    accessibleOwners: owners,
    transferIds: ['transfer-1'],
  });
  expect(Object.keys(result.accounts)).toEqual(['acc-to', 'acc-from']);
  expect(result.transfers?.['transfer-1']).toEqual({
    amountIn: 92000,
    amountOut: 500000,
    counterpartHidden: undefined,
    currencyIn: 'USD',
    currencyOut: 'BRL',
    dateIn: '2026-11-06',
    dateOut: '2026-11-04',
    feeTransactionId: 'row-fee',
    fromAccountId: 'acc-from',
    recurrenceId: undefined,
    toAccountId: 'acc-to',
  });
});

it('SHOULD flag the hidden counterpart AND leave its account out', async () => {
  spies.getTransferLookups.execute.mockResolvedValueOnce({
    accounts: [],
    transfers: [
      {
        ...mocks.transferLookup,
        amountIn: null,
        counterpartHidden: true,
        feeRowId: null,
        toAccountId: null,
      },
    ],
  });

  const result = await setup.attach(owners, [mocks.transferRow as never], mocks.baseLookups);

  expect(result.transfers?.['transfer-1']).toMatchObject({
    amountIn: null,
    counterpartHidden: true,
    toAccountId: undefined,
  });
  expect(Object.keys(result.accounts)).toEqual(['acc-from']);
});
