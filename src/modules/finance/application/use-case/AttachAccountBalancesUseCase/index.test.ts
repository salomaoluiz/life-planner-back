import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD read the unpaid sums of ALL the accounts in ONE call AND derive each balance from its ledger', async () => {
  mocks.accountRepository.findUnpaidSums.mockResolvedValue([
    { accountId: 'account-a', dueByEndOfMonth: -400 },
  ]);

  const result = await setup.execute({
    accounts: [mocks.accountA, mocks.accountB],
    today: mocks.today,
  });

  expect(mocks.accountRepository.findUnpaidSums).toHaveBeenCalledTimes(1);
  expect(mocks.accountRepository.findUnpaidSums).toHaveBeenCalledWith({
    accountIds: ['account-a', 'account-b'],
    today: mocks.today,
  });
  expect(result).toEqual([
    { account: mocks.accountA, balance: 15000, projectedBalance: 14600 },
    { account: mocks.accountB, balance: -300, projectedBalance: -300 },
  ]);
});

it('SHOULD return [] WITHOUT querying WHEN there are no accounts', async () => {
  expect(await setup.execute({ accounts: [], today: mocks.today })).toEqual([]);
  expect(mocks.accountRepository.findUnpaidSums).not.toHaveBeenCalled();
});

it.each([
  ['a missing today', { today: undefined }],
  ['an impossible date', { today: '2026-02-30' }],
  ['a timestamp', { today: '2026-10-15T10:00:00Z' }],
])('SHOULD throw ValidationError WHEN the input has %s', async (_label, patch) => {
  await expect(setup.execute({ accounts: [mocks.accountA], ...patch } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.accountRepository.findUnpaidSums).not.toHaveBeenCalled();
});
