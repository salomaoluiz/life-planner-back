import { UnprocessableEntityException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id };

it('SHOULD merge the patch over the stored transfer AND follow the amount out in the same currency', async () => {
  await setup.execute({ ...base, amountOut: 40000, description: 'New' });

  expect(spies.transferRepository.updateTransfer).toHaveBeenCalledWith(
    mocks.transfer.id,
    expect.objectContaining({ amountIn: 40000, amountOut: 40000, description: 'New', fee: null }),
  );
});

it('SHOULD keep both dates together WHEN only the out date moves AND a transfer dated on one day', async () => {
  await setup.execute({ ...base, dateOut: '2026-11-10' });

  expect(spies.transferRepository.updateTransfer).toHaveBeenCalledWith(
    mocks.transfer.id,
    expect.objectContaining({ dateIn: '2026-11-10', dateOut: '2026-11-10' }),
  );
});

it('SHOULD remove the fee with null AND keep it WHEN absent', async () => {
  spies.getTransfer.execute.mockResolvedValue({ ...mocks.transfer, fee: 350 });

  await setup.execute({ ...base, fee: null });
  await setup.execute({ ...base, notes: 'x' });

  const [first, second] = spies.transferRepository.updateTransfer.mock.calls;
  expect(first[1].fee).toBeNull();
  expect(second[1].fee).toBe(350);
});

it('SHOULD load the new account WHEN the destination changes AND reject the same account', async () => {
  await setup.execute({ ...base, toAccountId: 'acc-other' });
  expect(spies.transferRepository.updateTransfer).toHaveBeenCalledWith(
    mocks.transfer.id,
    expect.objectContaining({ to: expect.objectContaining({ accountId: 'acc-other' }) }),
  );

  await expect(setup.execute({ ...base, toAccountId: 'acc-from' })).rejects.toThrow('TRANSFER_SAME_ACCOUNT');
});

it('SHOULD keep the stored amount in for different currencies AND require it when paying a series occurrence without it', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValue([
    mocks.fromAccount,
    { ...mocks.toAccount, currency: 'USD' },
  ]);
  spies.getTransfer.execute.mockResolvedValue({ ...mocks.transfer, amountIn: 20000 });
  await setup.execute({ ...base, amountOut: 90000 });
  expect(spies.transferRepository.updateTransfer.mock.calls[0][1].amountIn).toBe(20000);

  spies.getTransfer.execute.mockResolvedValue({
    ...mocks.transfer,
    amountIn: null,
    paid: false,
    recurrenceId: 'series-1',
  });
  await expect(setup.execute({ ...base, paid: true })).rejects.toThrow('TRANSFER_AMOUNT_IN_REQUIRED');
});

describe('WHEN an account is archived', () => {
  beforeEach(() => {
    spies.accountRepository.findAccountsByIds.mockResolvedValue([
      { ...mocks.fromAccount, status: AccountStatus.ARCHIVED },
      mocks.toAccount,
    ]);
  });

  it('SHOULD allow changing only paid and notes', async () => {
    await setup.execute({ ...base, notes: 'late', paid: false });

    expect(spies.transferRepository.updateTransfer).toHaveBeenCalledTimes(1);
  });

  it('SHOULD refuse any other change with TRANSFER_ACCOUNT_ARCHIVED', async () => {
    await expect(setup.execute({ ...base, amountOut: 1000 })).rejects.toThrow(
      new UnprocessableEntityException('TRANSFER_ACCOUNT_ARCHIVED'),
    );
    expect(spies.transferRepository.updateTransfer).not.toHaveBeenCalled();
  });
});
