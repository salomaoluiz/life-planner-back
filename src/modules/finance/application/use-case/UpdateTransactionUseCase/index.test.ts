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
    blockArchivedCategory: false,
    categoryId: mocks.transaction.categoryId,
    creditCardId: undefined,
    currency: 'BRL' as const,
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
      blockArchivedCategory: true,
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(found);

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

describe('archived categories (spec 041)', () => {
  it('SHOULD NOT block the category WHEN the update keeps the stored one (even if archived)', async () => {
    await run({ categoryId: mocks.transaction.categoryId, value: 5 });

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ blockArchivedCategory: false }),
    );
  });
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce({
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce({
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce({
      ...mocks.transaction,
      accountId: null,
      creditCardId: mocks.card.id,
      invoiceMonth: '2026-10',
    });
    mocks.ensureConsistency.execute.mockResolvedValueOnce({ card: mocks.card });
    mocks.compute.execute.mockResolvedValueOnce([{ invoices: { projectedUsed: 0, used: 20_000 } }]);

    const result = await run({ date: '2026-12-31' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2026-12' }),
    );
    expect(result.overLimit).toBe(true);
    expect(result.invoiceData).toEqual([{ invoices: { projectedUsed: 0, used: 20_000 } }]);
  });

  it('SHOULD throw ValidationError WHEN the patch sends both sources', async () => {
    await expect(run({ accountId: 'a', creditCardId: 'c' })).rejects.toThrow(ValidationError);
  });
});

describe('chosen invoice (spec 095)', () => {
  function storedCardRow(patch: Record<string, unknown> = {}) {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce({
      ...mocks.transaction,
      accountId: null,
      creditCardId: mocks.card.id,
      date: '2026-10-30',
      invoiceMonth: '2026-11',
      ...patch,
    });
    mocks.ensureConsistency.execute.mockResolvedValueOnce({ card: mocks.card });
  }

  it('SHOULD store the chosen invoice WHEN only invoiceMonth is sent', async () => {
    storedCardRow();

    await run({ invoiceMonth: '2026-10' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2026-10' }),
    );
  });

  it('SHOULD leave the stored invoice alone WHEN neither date nor card changes', async () => {
    storedCardRow();

    await run({ description: 'Only the text' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: undefined }),
    );
  });

  it('SHOULD recompute from the date WHEN the date changes without invoiceMonth', async () => {
    storedCardRow();

    await run({ date: '2026-12-31' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2026-12' }),
    );
  });

  it('SHOULD validate the chosen invoice against the NEW date', async () => {
    storedCardRow();
    await run({ date: '2026-12-31', invoiceMonth: '2027-01' });
    storedCardRow();

    await expect(run({ date: '2026-12-31', invoiceMonth: '2026-10' })).rejects.toThrow(
      new UnprocessableEntityException('Invoice is not available for this date'),
    );
    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2027-01' }),
    );
  });

  it('SHOULD refuse a month outside the three options AND update nothing', async () => {
    storedCardRow();

    await expect(run({ invoiceMonth: '2027-01' })).rejects.toThrow(
      new UnprocessableEntityException('Invoice is not available for this date'),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD refuse invoiceMonth together with accountId AND on an account row', async () => {
    storedCardRow();
    mocks.ensureConsistency.execute.mockReset();
    mocks.ensureConsistency.execute.mockResolvedValue({});

    await expect(run({ accountId: 'new-account', invoiceMonth: '2026-10' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(run({ invoiceMonth: '2026-10' })).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD refuse invoiceMonth on a recurring row', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(mocks.recurring);

    await expect(
      setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        id: mocks.recurring.id,
        invoiceMonth: '2026-10',
        scope: 'ONLY_THIS',
        today: '2026-10-15',
      } as never),
    ).rejects.toThrow(new UnprocessableEntityException('Recurring transactions follow the date'));
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });
});

describe('move a projected series row to the next invoice (spec 096 FR 6)', () => {
  function projectedRow() {
    return {
      ...mocks.recurring,
      accountId: null,
      creditCardId: mocks.card.id,
      date: '2026-10-20',
      invoiceMonth: '2026-11',
      projected: true,
    };
  }
  function patch(over: Record<string, unknown>) {
    return {
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.recurring.id,
      invoiceMonth: '2026-12',
      scope: 'ONLY_THIS',
      today: '2026-10-15',
      ...over,
    } as never;
  }

  beforeEach(() => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue(projectedRow());
    mocks.ensureConsistency.execute.mockResolvedValue({
      card: { ...mocks.card, closingDay: 10 },
    });
  });

  it('SHOULD accept stored + 1 with ONLY_THIS AND keep the date', async () => {
    await setup.execute(patch({}));

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: undefined, invoiceMonth: '2026-12' }),
    );
  });

  it.each([
    ['another month', { invoiceMonth: '2027-01' }],
    ['the same month', { invoiceMonth: '2026-11' }],
    ['scope THIS_AND_NEXT', { scope: 'THIS_AND_NEXT' }],
  ])('SHOULD refuse %s', async (_, over) => {
    await expect(setup.execute(patch(over))).rejects.toThrow(
      new UnprocessableEntityException('Recurring transactions follow the date'),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue(mocks.installment);
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
    expect(mocks.transactionRepository.findTransactionScalarsById).toHaveBeenCalledTimes(1);
    expect(mocks.transactionRepository.findTransactionById).toHaveBeenCalledTimes(1);
  });

  it('SHOULD flag overLimit WHEN the new value leaves the card above its limit', async () => {
    mocks.compute.execute.mockResolvedValue([{ invoices: { projectedUsed: 0, used: 999_999 } }]);

    const result = await runInstallment({ scope: 'ONLY_THIS', value: 1 });

    expect(result.overLimit).toBe(true);
    expect(result.invoiceData).toEqual([{ invoices: { projectedUsed: 0, used: 999_999 } }]);
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
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue(mocks.transaction);
    await expect(run({ scope: 'ONLY_THIS', value: 5 })).rejects.toThrow(BadRequestException);
  });
});

describe('moving an installment between invoices (spec 095)', () => {
  // Plan dated 2026-10-20 on a card closing on the 31st: installment 3 is naturally on 2026-12.
  function row(invoiceMonth: string) {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue({
      ...mocks.installment,
      invoiceMonth,
    });
  }
  async function move(patch: Record<string, unknown>) {
    return setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.installment.id,
      today: '2026-10-15',
      ...patch,
    } as never);
  }

  beforeEach(() => {
    row('2026-12');
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });
  });

  it.each(['2026-11', '2026-12', '2027-01'])(
    'SHOULD move ONLY_THIS to %s (natural month 2026-12 ±1)',
    async (invoiceMonth) => {
      await move({ invoiceMonth, scope: 'ONLY_THIS' });

      expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ id: mocks.installment.id, invoiceMonth }),
      );
      expect(mocks.installmentPlanRepository.updateFromNumber).not.toHaveBeenCalled();
    },
  );

  it.each(['2026-10', '2027-02'])(
    'SHOULD refuse %s, two months from the natural one, AND write nothing',
    async (invoiceMonth) => {
      await expect(move({ invoiceMonth, scope: 'ONLY_THIS' })).rejects.toThrow(
        new UnprocessableEntityException('Invoice is not available for this date'),
      );
      await expect(move({ invoiceMonth, scope: 'THIS_AND_NEXT' })).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
      expect(mocks.installmentPlanRepository.updateFromNumber).not.toHaveBeenCalled();
    },
  );

  it('SHOULD shift this and the later rows by the months between the current and the chosen invoice', async () => {
    await move({ invoiceMonth: '2027-01', scope: 'THIS_AND_NEXT' });

    expect(mocks.installmentPlanRepository.updateFromNumber).toHaveBeenCalledWith(
      expect.objectContaining({ fromNumber: 3, invoiceMonthShift: 1, planId: 'plan-1' }),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD shift backwards across the year', async () => {
    mocks.installmentPlanRepository.findPlanById.mockResolvedValue({
      creditCardId: mocks.card.id,
      date: '2026-11-20',
      id: 'plan-1',
      prepayment: null,
    });
    row('2027-01');

    await move({ invoiceMonth: '2026-12', scope: 'THIS_AND_NEXT' });

    expect(mocks.installmentPlanRepository.updateFromNumber).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonthShift: -1 }),
    );
  });

  it('SHOULD send no shift WHEN the chosen invoice is the current one', async () => {
    await move({ invoiceMonth: '2026-12', scope: 'THIS_AND_NEXT', value: 500 });

    expect(mocks.installmentPlanRepository.updateFromNumber).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonthShift: undefined, value: 500 }),
    );
  });

  it('SHOULD refuse an invoice move on a prepaid plan AND write nothing', async () => {
    mocks.installmentPlanRepository.findPlanById.mockResolvedValue({
      creditCardId: mocks.card.id,
      date: '2026-10-20',
      id: 'plan-1',
      prepayment: { id: 'prepayment-1' },
    });

    await expect(move({ invoiceMonth: '2027-01', scope: 'ONLY_THIS' })).rejects.toThrow(
      new UnprocessableEntityException('Undo the prepayment first'),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the plan is gone', async () => {
    mocks.installmentPlanRepository.findPlanById.mockResolvedValue(undefined);

    await expect(move({ invoiceMonth: '2027-01', scope: 'ONLY_THIS' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD NOT look the plan up WHEN no invoice month is sent', async () => {
    await move({ scope: 'ONLY_THIS', value: 5 });

    expect(mocks.installmentPlanRepository.findPlanById).not.toHaveBeenCalled();
  });
});

describe('paid status (spec 033)', () => {
  function unpaid() {
    return { ...mocks.transaction, paid: false };
  }

  it('SHOULD move the date to today WHEN an unpaid row is paid without a date', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(unpaid());

    await run({ paid: true });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-15', paid: true }),
    );
  });

  it('SHOULD keep the date sent with the payment', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(unpaid());

    await run({ date: '2026-10-11', paid: true });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-11', paid: true }),
    );
  });

  it('SHOULD keep the date WHEN unpaying AND leave paid alone WHEN only the date changes', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce({
      ...mocks.transaction,
      paid: true,
    });
    await run({ paid: false });
    await run({ date: '2026-10-20' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ date: undefined, paid: false }),
    );
    expect(mocks.transactionRepository.updateTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ date: '2026-10-20', paid: undefined }),
    );
  });

  it('SHOULD refuse paid on a card row (422) AND clear paid WHEN an account row moves to a card', async () => {
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });

    await expect(run({ creditCardId: mocks.card.id, paid: true })).rejects.toThrow(
      new UnprocessableEntityException('Card purchases follow their invoice'),
    );
    await run({ creditCardId: mocks.card.id });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ paid: null }),
    );
  });

  it('SHOULD give a paid value WHEN a card row moves back to an account', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce({
      ...mocks.transaction,
      accountId: null,
      creditCardId: mocks.card.id,
      date: '2026-10-20',
      invoiceMonth: '2026-10',
    });

    await run({ accountId: 'new-account' });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ paid: false }),
    );
  });

  it('SHOULD refuse paid on an installment (422)', async () => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValueOnce(mocks.installment);

    await expect(run({ paid: true, scope: 'ONLY_THIS' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('recurring occurrences (spec 034)', () => {
  async function runRecurring(patch: Record<string, unknown>) {
    return setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.recurring.id,
      today: '2026-10-15',
      ...patch,
    } as never);
  }

  beforeEach(() => {
    mocks.transactionRepository.findTransactionScalarsById.mockResolvedValue(mocks.recurring);
  });

  it('SHOULD change only that row with scope ONLY_THIS', async () => {
    await runRecurring({ scope: 'ONLY_THIS', value: 777 });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: mocks.recurring.id, value: 777 }),
    );
  });

  it('SHOULD let a payment through without scope AND move its date to today', async () => {
    await runRecurring({ paid: true });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-15', paid: true }),
    );
  });

  it('SHOULD let a payment with its own date through without scope', async () => {
    await runRecurring({ date: '2026-10-10', paid: true });

    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-10', paid: true }),
    );
  });

  it('SHOULD answer 422 "Choose the edit scope" WHEN another field comes without scope', async () => {
    await expect(runRecurring({ value: 5 })).rejects.toThrow('Choose the edit scope');
    await expect(runRecurring({ date: '2026-10-20' })).rejects.toThrow('Choose the edit scope');
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 "Use the recurrence split" for THIS_AND_NEXT', async () => {
    await expect(runRecurring({ scope: 'THIS_AND_NEXT', value: 5 })).rejects.toThrow(
      'Use the recurrence split',
    );
  });

  it.each([
    ['owner', 'FAMILY'],
    ['ownerId', 'x'],
  ])('SHOULD answer 422 WHEN %s is sent', async (field, value) => {
    await expect(runRecurring({ [field]: value, scope: 'ONLY_THIS' })).rejects.toThrow(
      'Owner cannot change on a recurring transaction',
    );
  });

  it.each([
    ['accountId', 'x'],
    ['creditCardId', 'x'],
    ['type', 'INCOME'],
  ])('SHOULD answer 400 WHEN %s is sent', async (field, value) => {
    await expect(runRecurring({ [field]: value, scope: 'ONLY_THIS' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('currency (spec 040)', () => {
  it('SHOULD check the stored currency against the new account AND write nothing WHEN it refuses', async () => {
    mocks.ensureConsistency.execute.mockRejectedValueOnce(
      new UnprocessableEntityException('Transaction currency must match the account currency'),
    );

    await expect(run({ accountId: 'other-account' })).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ currency: mocks.transaction.currency }),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = {
    accessibleOwners: mocks.accessibleOwners,
    description: 'Updated',
    id: mocks.transaction.id,
    today: '2026-10-15',
  };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});

it('SHOULD pass the tag names (and [] to clear them) to the repository', async () => {
  await run({ tags: ['fixo'] });

  expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ tags: ['fixo'] }),
  );

  await run({ tags: [] });

  expect(mocks.transactionRepository.updateTransaction).toHaveBeenLastCalledWith(
    expect.objectContaining({ tags: [] }),
  );
});

it('SHOULD accept a tags-only patch AND reject more than 10 tags', async () => {
  await expect(run({ tags: [] })).resolves.toBeDefined();
  await expect(run({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD update the notes alone AND clear them with null (spec 059)', async () => {
  await run({ notes: 'Reembolsar' });
  expect(mocks.transactionRepository.updateTransaction).toHaveBeenLastCalledWith(
    expect.objectContaining({ notes: 'Reembolsar' }),
  );

  await run({ notes: null });
  expect(mocks.transactionRepository.updateTransaction).toHaveBeenLastCalledWith(
    expect.objectContaining({ notes: null }),
  );
});
