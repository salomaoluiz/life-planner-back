import { UnprocessableEntityException } from '@nestjs/common';

import { TransactionType } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

describe('only paid (FR 19)', () => {
  it('SHOULD set paid on the whole split', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.split.id,
      paid: false,
    });

    expect(spies.splitRepository.setSplitPaid).toHaveBeenCalledWith(mocks.split.id, false);
    expect(result).toEqual({ split: mocks.split });
    expect(spies.splitRepository.updateSplit).not.toHaveBeenCalled();
  });

  it('SHOULD refuse paid on a card split', async () => {
    spies.getSplitUseCase.execute.mockResolvedValueOnce({
      ...mocks.split,
      accountId: null,
      creditCardId: 'card-1',
    });

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.split.id, paid: true }),
    ).rejects.toThrow('Card purchases follow their invoice');
  });
});

describe('full replacement (FR 18)', () => {
  it('SHOULD keep the stored shared fields AND send kept parts with their ids', async () => {
    await setup.execute(mocks.fullInput);

    const [id, written] = spies.splitRepository.updateSplit.mock.calls[0];

    expect(id).toBe(mocks.split.id);
    expect(written).toEqual(
      expect.objectContaining({
        accountId: mocks.split.accountId,
        date: mocks.split.date,
        description: mocks.split.description,
        notes: null,
        paid: true,
      }),
    );
    expect(written.parts[0]).toEqual(
      expect.objectContaining({ id: mocks.split.parts[0].id, value: 20000 }),
    );
    expect(written.parts[1].id).toBeUndefined();
  });

  it('SHOULD only block an archived category the split did not already use', async () => {
    await setup.execute(mocks.fullInput);

    const calls = spies.ensureConsistency.execute.mock.calls.map(([call]) => call);

    expect(calls.find((call) => call.categoryId === mocks.split.parts[0].categoryId)).toEqual(
      expect.objectContaining({ blockArchivedCategory: false }),
    );
    expect(calls.find((call) => call.categoryId === 'cat-9')).toEqual(
      expect.objectContaining({ blockArchivedCategory: true }),
    );
  });

  it('SHOULD let one part through (dissolve) AND refuse none', async () => {
    await setup.execute({ ...mocks.fullInput, parts: [mocks.fullInput.parts?.[0] as never] });
    await expect(setup.execute({ ...mocks.fullInput, parts: [] })).rejects.toThrow(
      'SPLIT_TOO_FEW_PARTS',
    );

    expect(spies.splitRepository.updateSplit).toHaveBeenCalledTimes(1);
  });

  it('SHOULD refuse a total that does not match', async () => {
    await expect(setup.execute({ ...mocks.fullInput, total: 5 })).rejects.toThrow(
      'SPLIT_TOTAL_MISMATCH',
    );
  });

  it('SHOULD refuse moving the split to a source of another owner (422)', async () => {
    spies.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      ownerId: 'someone-else',
    });
    await expect(
      setup.execute({
        ...mocks.fullInput,
        accessibleOwners: [
          ...mocks.accessibleOwners,
          { owner: mocks.split.owner, ownerId: 'someone-else' },
        ],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('SHOULD refuse an archived family (422)', async () => {
    await expect(
      setup.execute({
        ...mocks.fullInput,
        accessibleOwners: [{ ...mocks.accessibleOwners[0], archived: true }],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('SHOULD refuse paid on a card AND income parts on a card', async () => {
    const card = { ...mocks.split, accountId: null, creditCardId: 'card-1' };

    spies.getSplitUseCase.execute.mockResolvedValue(card);
    await expect(setup.execute({ ...mocks.fullInput, paid: true })).rejects.toThrow(
      'Card purchases follow their invoice',
    );
    await expect(
      setup.execute({
        ...mocks.fullInput,
        parts: [
          mocks.fullInput.parts?.[0] as never,
          { categoryId: 'c', type: TransactionType.INCOME, value: 1 },
        ],
      }),
    ).rejects.toThrow('SPLIT_CARD_EXPENSE_ONLY');
  });

  it('SHOULD keep the stored invoice of a card split WHEN card and date do not change, else recompute', async () => {
    spies.getSplitUseCase.execute.mockResolvedValue({
      ...mocks.split,
      accountId: null,
      creditCardId: 'card-1',
      invoiceMonth: '2026-12',
    });

    await setup.execute(mocks.fullInput);
    expect(spies.splitRepository.updateSplit.mock.calls[0][1].invoiceMonth).toBe('2026-12');
    expect(spies.splitRepository.updateSplit.mock.calls[0][1].paid).toBeNull();

    await setup.execute({ ...mocks.fullInput, date: '2026-11-20' });
    expect(spies.splitRepository.updateSplit.mock.calls[1][1].invoiceMonth).toMatch(
      /^\d{4}-\d{2}$/,
    );
    await expect(setup.execute({ ...mocks.fullInput, invoiceMonth: '2030-01' })).rejects.toThrow(
      'Invoice is not available for this date',
    );
  });
});

describe('stock purchase split (spec 120 FR 40)', () => {
  it('SHOULD refuse the parts from finance (422) AND still allow paid', async () => {
    spies.getSplitUseCase.execute.mockResolvedValue({
      ...mocks.split,
      stockPurchaseId: 'purchase-1',
    });

    await expect(
      setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        date: mocks.split.date,
        description: 'x',
        id: mocks.split.id,
        parts: [],
      }),
    ).rejects.toThrow('SPLIT_FROM_STOCK_PURCHASE');
    expect(spies.splitRepository.updateSplit).not.toHaveBeenCalled();

    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.split.id,
      paid: true,
    });
    expect(spies.splitRepository.setSplitPaid).toHaveBeenCalledWith(mocks.split.id, true);
  });
});
