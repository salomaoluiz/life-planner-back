import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD create a same-currency transfer with the amount in filled AND the in date defaulting to the out date', async () => {
  expect(await setup.execute(mocks.input)).toBe(mocks.transfer);

  expect(spies.transferRepository.createTransfer).toHaveBeenCalledWith(
    expect.objectContaining({
      amountIn: 100000,
      amountOut: 100000,
      createdBy: 'user-1',
      dateIn: '2026-11-04',
      fee: null,
      from: expect.objectContaining({ accountId: 'acc-from', currency: 'BRL' }),
      to: expect.objectContaining({ accountId: 'acc-to' }),
    }),
  );
});

it('SHOULD require the amount in for different currencies AND accept it with a fee', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValue([
    mocks.fromAccount,
    { ...mocks.toAccount, currency: 'USD' },
  ]);

  await expect(setup.execute(mocks.input)).rejects.toThrow('TRANSFER_AMOUNT_IN_REQUIRED');
  await setup.execute({ ...mocks.input, amountIn: 20000, dateIn: '2026-11-06', fee: 350 });

  expect(spies.transferRepository.createTransfer).toHaveBeenCalledWith(
    expect.objectContaining({ amountIn: 20000, dateIn: '2026-11-06', fee: 350 }),
  );
});

it.each([
  ['same account', { toAccountId: 'acc-from' }, 'TRANSFER_SAME_ACCOUNT'],
  ['different amounts in the same currency', { amountIn: 90000 }, 'TRANSFER_AMOUNT_MISMATCH'],
  ['an in date before the out date', { dateIn: '2026-11-03' }, 'TRANSFER_DATE_IN_BEFORE_OUT'],
])('SHOULD throw 422 %s AND write nothing', async (_label, patch, code) => {
  await expect(setup.execute({ ...mocks.input, ...patch })).rejects.toThrow(
    new UnprocessableEntityException(code),
  );
  expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
});

it('SHOULD allow an unpaid series occurrence of different currencies without the amount in', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValue([
    mocks.fromAccount,
    { ...mocks.toAccount, currency: 'USD' },
  ]);

  await setup.execute({ ...mocks.input, occurrenceNumber: 2, paid: false, recurrenceId: 'series-1' });

  expect(spies.transferRepository.createTransfer).toHaveBeenCalledWith(
    expect.objectContaining({ amountIn: null, occurrenceNumber: 2, recurrenceId: 'series-1' }),
  );
});

it('SHOULD throw NotFound WHEN an account is missing or belongs to an owner the caller cannot access', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValueOnce([mocks.fromAccount]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  spies.accountRepository.findAccountsByIds.mockResolvedValueOnce([
    mocks.fromAccount,
    { ...mocks.toAccount, ownerId: 'stranger' },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
});

it('SHOULD throw 422 TRANSFER_ACCOUNT_ARCHIVED WHEN an account is archived AND 422 WHEN its family is archived', async () => {
  spies.accountRepository.findAccountsByIds.mockResolvedValueOnce([
    mocks.fromAccount,
    { ...mocks.toAccount, status: AccountStatus.ARCHIVED },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow('TRANSFER_ACCOUNT_ARCHIVED');

  const archivedOwners = mocks.accessibleOwners.map((owner, index) =>
    index === 1 ? { ...owner, archived: true } : owner,
  );
  await expect(setup.execute({ ...mocks.input, accessibleOwners: archivedOwners })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(spies.transferRepository.createTransfer).not.toHaveBeenCalled();
});
