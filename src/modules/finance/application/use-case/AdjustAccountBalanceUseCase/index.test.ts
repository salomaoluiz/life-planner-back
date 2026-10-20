import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { INT4_MAX, INT4_MIN } from '@finance/application/dto/FinanceCommon';
import {
  BALANCE_ADJUSTMENT_DESCRIPTION,
  SYSTEM_CATEGORY_IDS,
} from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

async function run(balance: number) {
  return setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    balance,
    id: mocks.account.id,
    today: mocks.today,
  });
}

it('SHOULD record an INCOME adjustment for the positive difference, dated today, on the system category, AND return the refreshed balances', async () => {
  const result = await run(12000);

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith({
    accountId: mocks.account.id,
    categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT],
    currency: 'BRL' as const,
    date: mocks.today,
    description: BALANCE_ADJUSTMENT_DESCRIPTION,
    owner: mocks.account.owner,
    ownerId: mocks.account.ownerId,
    paid: true,
    type: TransactionType.INCOME,
    value: 5000,
  });
  expect(result).toBe(mocks.updated);
  expect(mocks.attach.execute).toHaveBeenNthCalledWith(1, {
    accounts: [mocks.account],
    today: mocks.today,
  });
});

it('SHOULD record an EXPENSE adjustment for a negative difference', async () => {
  await run(2000);

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ type: TransactionType.EXPENSE, value: 5000 }),
  );
});

it('SHOULD create nothing AND return the account unchanged WHEN the target equals the current balance', async () => {
  const result = await run(7000);

  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
  expect(result).toBe(mocks.current);
});

it('SHOULD compare against the CURRENT balance (not the projected one)', async () => {
  // projected is 80,00: asking for 80,00 still needs a +10,00 adjustment.
  await run(8000);

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ type: TransactionType.INCOME, value: 1000 }),
  );
});

it('SHOULD accept a difference of exactly INT4_MAX AND reject one cent more with 400 (never a database overflow)', async () => {
  mocks.attach.execute.mockReset().mockResolvedValueOnce([{ ...mocks.current, balance: 0 }]);
  mocks.attach.execute.mockResolvedValueOnce([mocks.updated]);

  await expect(run(INT4_MAX)).resolves.toBe(mocks.updated);

  mocks.transactionRepository.createTransaction.mockClear();
  mocks.attach.execute.mockReset().mockResolvedValueOnce([{ ...mocks.current, balance: -1 }]);

  await expect(run(INT4_MAX)).rejects.toThrow(BadRequestException);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it('SHOULD answer 400 WHEN going from +2,000,000,000 to -2,000,000,000 cents', async () => {
  mocks.attach.execute
    .mockReset()
    .mockResolvedValueOnce([{ ...mocks.current, balance: 2_000_000_000 }]);

  await expect(run(-2_000_000_000)).rejects.toThrow(BadRequestException);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it('SHOULD answer 400 for the INT4 minimum as a target from zero (the transaction value would be 2,147,483,648)', async () => {
  mocks.attach.execute.mockReset().mockResolvedValueOnce([{ ...mocks.current, balance: 0 }]);

  await expect(run(INT4_MIN)).rejects.toThrow(BadRequestException);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it('SHOULD throw Unprocessable (422) AND create nothing WHEN the account is archived', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    status: AccountStatus.ARCHIVED,
  });

  await expect(run(1)).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.account, ownerId: 'stranger' }],
])('SHOULD throw NotFound (404) WHEN the account is %s', async (_label, found) => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce(found);

  await expect(run(1)).rejects.toThrow(NotFoundException);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it.each([
  ['a fractional balance', { balance: 1.5 }],
  ['a balance above int4', { balance: INT4_MAX + 1 }],
  ['a string balance', { balance: '100' }],
  ['an invalid today', { today: '2026-13-01' }],
])('SHOULD throw ValidationError WHEN the input has %s', async (_label, patch) => {
  await expect(
    setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      balance: 100,
      id: mocks.account.id,
      today: mocks.today,
      ...patch,
    } as never),
  ).rejects.toThrow(ValidationError);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it('SHOULD record the adjustment in the currency of the account', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    currency: 'USD',
  });

  await run(12000);

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ currency: 'USD' }),
  );
});
