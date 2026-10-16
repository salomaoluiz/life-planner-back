import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

async function run(patch: Record<string, unknown>) {
  return setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.transaction.id,
    today: '2026-10-15',
    ...patch,
  } as never);
}

it('SHOULD validate the RESULTING record (patch merged over the stored one) AND update only the sent fields', async () => {
  const result = await run({ description: ' Updated ', value: 100 });

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    accountId: mocks.transaction.accountId,
    blockArchivedAccount: false,
    categoryId: mocks.transaction.categoryId,
    creditCardId: undefined,
    owner: mocks.transaction.owner,
    ownerId: mocks.transaction.ownerId,
    type: mocks.transaction.type,
  });
  expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith({
    accountId: undefined,
    categoryId: undefined,
    creditCardId: undefined,
    date: undefined,
    description: 'Updated',
    id: mocks.transaction.id,
    invoiceMonth: undefined,
    owner: undefined,
    ownerId: undefined,
    type: undefined,
    value: 100,
  });
  expect(result).toEqual({ overLimit: false, transaction: mocks.updated });
});

it('SHOULD check a new account / category / type against the stored owner', async () => {
  await run({
    accountId: 'new-account',
    categoryId: 'new-category',
    type: TransactionType.INCOME,
  });

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'new-account',
      blockArchivedAccount: true,
      categoryId: 'new-category',
      ownerId: mocks.transaction.ownerId,
      type: TransactionType.INCOME,
    }),
  );
});

describe('changing the owner', () => {
  const move = {
    accountId: 'family-account',
    categoryId: 'family-category',
    owner: OwnerType.FAMILY,
    ownerId: 'family-id',
  };

  it('SHOULD check the new account and category against the NEW owner', async () => {
    await run(move);

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(expect.objectContaining(move));
    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ owner: OwnerType.FAMILY, ownerId: 'family-id' }),
    );
  });

  it('SHOULD reject (400 from the consistency check) a move WHEN the account / category stay with the old owner', async () => {
    mocks.ensureConsistency.execute.mockRejectedValueOnce(new BadRequestException());

    await expect(run({ owner: OwnerType.FAMILY, ownerId: 'family-id' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: mocks.transaction.accountId,
        owner: OwnerType.FAMILY,
        ownerId: 'family-id',
      }),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD throw Forbidden (403) WHEN the new owner is not accessible', async () => {
    await expect(run({ ...move, ownerId: 'someone-elses-family' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(mocks.ensureConsistency.execute).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.transaction, ownerId: 'stranger' }],
])(
  'SHOULD throw NotFound (404) AND update nothing WHEN the transaction is %s',
  async (_label, found) => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(found);

    await expect(run({ value: 1 })).rejects.toThrow(NotFoundException);
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  },
);

it.each([
  ['an empty patch', {}],
  ['value 0', { value: 0 }],
  ['a fractional value', { value: 1.5 }],
  ['a value above int4', { value: INT4_MAX + 1 }],
  ['an impossible date', { date: '2026-04-31' }],
  ['a whitespace-only description', { description: '   ' }],
  ['null on a required field', { description: null }],
])('SHOULD throw ValidationError WHEN the patch is %s', async (_label, patch) => {
  await expect(run(patch)).rejects.toThrow(ValidationError);
  expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
});

describe('archived accounts and balance adjustments (spec 028)', () => {
  it('SHOULD NOT block an archived account WHEN the transaction stays on its account', async () => {
    await run({ accountId: mocks.transaction.accountId, value: 5 });

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ blockArchivedAccount: false }),
    );
  });

  it('SHOULD throw Unprocessable (422) AND update nothing WHEN it moves into an archived account', async () => {
    mocks.ensureConsistency.execute.mockRejectedValueOnce(
      new UnprocessableEntityException('Account is archived'),
    );

    await expect(run({ accountId: 'archived-account' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD throw Unprocessable (422) "Balance adjustments cannot be edited" AND update nothing for a system-category transaction', async () => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(
      new TransactionEntityFixture()
        .withOwnerId(mocks.transaction.ownerId)
        .withBalanceAdjustment()
        .build(),
    );

    await expect(run({ value: 1 })).rejects.toThrow(
      new UnprocessableEntityException('Balance adjustments cannot be edited'),
    );
    expect(mocks.ensureConsistency.execute).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });
});

describe('card purchases and the invoice payment (spec 029)', () => {
  it('SHOULD refuse to edit the INVOICE_PAYMENT transaction (422) AND update nothing', async () => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.transaction,
      category: { ...mocks.transaction.category, systemKey: SystemCategoryKey.INVOICE_PAYMENT },
    });

    await expect(run({ value: 1 })).rejects.toThrow(
      new UnprocessableEntityException('Use the invoice to change this payment'),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD switch an account expense to a card: clears the account, sets the invoice month, blocks an archived card', async () => {
    mocks.ensureConsistency.execute.mockResolvedValueOnce({ card: mocks.card });

    const result = await run({ creditCardId: mocks.card.id, date: '2026-11-01' });

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: undefined,
        blockArchivedAccount: true,
        creditCardId: mocks.card.id,
      }),
    );
    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: null,
        creditCardId: mocks.card.id,
        invoiceMonth: '2026-11',
      }),
    );
    expect(result.overLimit).toBe(false);
  });

  it('SHOULD switch a card purchase back to an account: clears card and invoice month', async () => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.transaction,
      accountId: null,
      creditCardId: mocks.card.id,
      invoiceMonth: '2026-10',
    });

    await run({ accountId: 'new-account' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'new-account',
        creditCardId: null,
        invoiceMonth: null,
      }),
    );
  });

  it('SHOULD recompute the invoice month WHEN only the date of a card purchase changes, AND flag overLimit', async () => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.transaction,
      accountId: null,
      creditCardId: mocks.card.id,
      invoiceMonth: '2026-10',
    });
    mocks.ensureConsistency.execute.mockResolvedValueOnce({ card: mocks.card });
    mocks.compute.execute.mockResolvedValueOnce([{ invoices: { used: 20_000 } }]);

    const result = await run({ date: '2026-12-31' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2026-12' }),
    );
    expect(result.overLimit).toBe(true);
  });

  it('SHOULD throw ValidationError WHEN the patch sends both sources', async () => {
    await expect(run({ accountId: 'a', creditCardId: 'c' })).rejects.toThrow(ValidationError);
  });
});

describe('installments (spec 030)', () => {
  async function runInstallment(patch: Record<string, unknown>) {
    return setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.installment.id,
      today: '2026-10-15',
      ...patch,
    } as never);
  }

  beforeEach(() => {
    mocks.transactionRepository.findTransactionById.mockResolvedValue(mocks.installment);
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });
  });

  it('SHOULD change ONLY that row with scope ONLY_THIS', async () => {
    const result = await runInstallment({ scope: 'ONLY_THIS', value: 777 });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith({
      categoryId: undefined,
      description: undefined,
      id: mocks.installment.id,
      value: 777,
    });
    expect(mocks.installmentPlanRepository.updateFromNumber).not.toHaveBeenCalled();
    expect(result.overLimit).toBe(false);
  });

  it('SHOULD change this and the later rows with scope THIS_AND_NEXT, starting at its number', async () => {
    await runInstallment({ description: 'Laptop', scope: 'THIS_AND_NEXT', value: 500 });

    expect(mocks.installmentPlanRepository.updateFromNumber).toHaveBeenCalledWith({
      categoryId: undefined,
      description: 'Laptop',
      fromNumber: 3,
      planId: 'plan-1',
      value: 500,
    });
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.findTransactionById).toHaveBeenCalledTimes(2);
  });

  it('SHOULD flag overLimit WHEN the new value leaves the card above its limit', async () => {
    mocks.compute.execute.mockResolvedValue([{ invoices: { used: 999_999 } }]);

    expect((await runInstallment({ scope: 'ONLY_THIS', value: 1 })).overLimit).toBe(true);
  });

  it('SHOULD answer 400 WHEN scope is missing', async () => {
    await expect(runInstallment({ value: 5 })).rejects.toThrow(BadRequestException);
  });

  it.each([
    ['date', '2026-10-21'],
    ['type', 'INCOME'],
    ['owner', 'FAMILY'],
    ['ownerId', 'x'],
  ])('SHOULD answer 400 WHEN an installment edit sends %s', async (field, value) => {
    await expect(runInstallment({ [field]: value, scope: 'ONLY_THIS', value: 5 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each([['accountId'], ['creditCardId']])(
    'SHOULD answer 422 "Edit the installment plan instead" WHEN %s is sent',
    async (field) => {
      await expect(runInstallment({ [field]: 'x', scope: 'ONLY_THIS' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    },
  );

  it('SHOULD answer 400 WHEN scope is sent for a plain transaction', async () => {
    mocks.transactionRepository.findTransactionById.mockResolvedValue(mocks.transaction);
    await expect(run({ scope: 'ONLY_THIS', value: 5 })).rejects.toThrow(BadRequestException);
  });
});
