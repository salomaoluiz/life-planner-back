import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD create the split with the shared fields, inherited descriptions AND the adjustment id', async () => {
  expect(await setup.execute(mocks.input)).toBe(mocks.created);

  const written = spies.splitRepository.createSplit.mock.calls[0][0];

  expect(written).toEqual(
    expect.objectContaining({
      accountId: 'acc-1',
      creditCardId: null,
      date: '2026-11-15',
      description: 'Mercado',
      invoiceMonth: null,
      owner: mocks.account.owner,
      ownerId: mocks.account.ownerId,
      paid: true,
      sourceTransactionId: undefined,
    }),
  );
  expect(written.parts).toEqual([
    expect.objectContaining({ categoryId: 'cat-1', description: null, value: 12000 }),
    expect.objectContaining({ description: 'Detergente', tags: ['casa'] }),
    expect.objectContaining({
      categoryId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.SPLIT_ADJUSTMENT],
      value: -440,
    }),
  ]);
});

it('SHOULD check each distinct category and type once, allowing the adjustment', async () => {
  await setup.execute({
    ...mocks.input,
    parts: [mocks.input.parts[0], mocks.input.parts[0], mocks.input.parts[2]],
    total: undefined,
  });

  expect(spies.ensureConsistency.execute).toHaveBeenCalledTimes(2);
  expect(spies.ensureConsistency.execute).toHaveBeenCalledWith(
    expect.objectContaining({ allowSplitAdjustment: true, blockArchivedCategory: true }),
  );
});

it('SHOULD start unpaid WHEN dated after today AND honor an explicit paid', async () => {
  await setup.execute({ ...mocks.input, date: '2026-12-01' });
  await setup.execute({ ...mocks.input, paid: false });

  expect(spies.splitRepository.createSplit.mock.calls[0][0].paid).toBe(false);
  expect(spies.splitRepository.createSplit.mock.calls[1][0].paid).toBe(false);
});

it.each([
  ['SPLIT_TOO_FEW_PARTS', { parts: [mocks.input.parts[0]], total: undefined }],
  ['SPLIT_TOTAL_MISMATCH', { total: 28000 }],
])('SHOULD throw %s WHEN the parts break the rule', async (code, override) => {
  await expect(setup.execute({ ...mocks.input, ...override })).rejects.toThrow(code);
  expect(spies.splitRepository.createSplit).not.toHaveBeenCalled();
});

it('SHOULD refuse a currency different from the source', async () => {
  await expect(setup.execute({ ...mocks.input, currency: 'USD' })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

describe('card splits', () => {
  const cardInput = {
    ...mocks.input,
    accountId: undefined,
    creditCardId: 'card-1',
    total: undefined,
  };

  it('SHOULD compute the invoice month AND leave paid empty', async () => {
    await setup.execute(cardInput);

    const written = spies.splitRepository.createSplit.mock.calls[0][0];

    expect(written.creditCardId).toBe('card-1');
    expect(written.invoiceMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(written.paid).toBeNull();
  });

  it('SHOULD refuse paid on a card (422)', async () => {
    await expect(setup.execute({ ...cardInput, paid: true })).rejects.toThrow(
      'Card purchases follow their invoice',
    );
  });

  it('SHOULD refuse an income part (SPLIT_CARD_EXPENSE_ONLY)', async () => {
    await expect(
      setup.execute({
        ...cardInput,
        parts: [mocks.input.parts[0], { ...mocks.input.parts[1], type: TransactionType.INCOME }],
      }),
    ).rejects.toThrow('SPLIT_CARD_EXPENSE_ONLY');
  });

  it('SHOULD refuse an invoice month that is not available for the date', async () => {
    await expect(setup.execute({ ...cardInput, invoiceMonth: '2030-01' })).rejects.toThrow(
      'Invoice is not available for this date',
    );
    await expect(
      setup.execute({ ...mocks.input, invoiceMonth: '2026-11', total: undefined }),
    ).rejects.toThrow('Invoice is not available for this date');
  });
});

describe('convert a saved transaction (FR 16)', () => {
  const fromInput = { ...mocks.input, fromTransactionId: 'row-1', total: undefined };

  it('SHOULD keep the id of the original row as the first part AND carry its series position', async () => {
    spies.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.ordinaryRow,
      occurrenceNumber: 3,
      recurrenceId: 'rec-1',
    });

    await setup.execute(fromInput);

    expect(spies.splitRepository.createSplit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        occurrenceNumber: 3,
        recurrenceId: 'rec-1',
        sourceTransactionId: mocks.ordinaryRow.id,
      }),
    );
  });

  it('SHOULD throw NotFound WHEN the row is missing or unreadable', async () => {
    spies.transactionRepository.findTransactionById.mockResolvedValueOnce(undefined);
    await expect(setup.execute(fromInput)).rejects.toThrow(NotFoundException);
    await expect(
      setup.execute({ ...fromInput, accessibleOwners: [mocks.accessibleOwners[1]] }),
    ).rejects.toThrow();
  });

  it('SHOULD throw SPLIT_SOURCE_NOT_ALLOWED for an installment AND 422 for another owner', async () => {
    spies.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.ordinaryRow,
      installmentPlanId: 'plan',
    });
    await expect(setup.execute(fromInput)).rejects.toThrow('SPLIT_SOURCE_NOT_ALLOWED');
    spies.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.ordinaryRow,
      owner: 'FAMILY',
      ownerId: 'family-1',
    });
    await expect(
      setup.execute({
        ...fromInput,
        accessibleOwners: [
          ...mocks.accessibleOwners,
          { owner: 'FAMILY' as never, ownerId: 'family-1' },
        ],
      }),
    ).rejects.toThrow('The split belongs to another owner');
  });
});
