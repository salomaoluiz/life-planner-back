import { toIncomeOutput } from './income.service';
import { mocks, setup } from './income.service.mocks';

const { owners, useCases, userId, view } = mocks;
const id = view.income.id;

describe('toIncomeOutput', () => {
  it('SHOULD map every field of the view', () => {
    expect(toIncomeOutput(view)).toEqual({
      accountId: view.income.accountId,
      amountPerUnit: '0.28',
      assetId: view.income.assetId,
      categoryId: view.income.categoryId,
      currency: 'BRL',
      estimatedGross: 8400,
      estimatedWithheld: 1260,
      exDate: '2026-09-10',
      id,
      netAmount: 7140,
      notes: undefined,
      overdue: false,
      paymentDate: '2026-10-30',
      quantity: '300',
      status: 'RECEIVED',
      suggestionId: undefined,
      transactionId: view.income.transactionId,
      type: 'JCP',
      withholdingRate: '0.15',
    });
  });

  it('SHOULD leave the nulls out', () => {
    expect(toIncomeOutput(mocks.bareView)).toMatchObject({
      accountId: undefined,
      amountPerUnit: undefined,
      categoryId: undefined,
      exDate: undefined,
      quantity: undefined,
      transactionId: undefined,
    });
  });
});

describe('writes', () => {
  beforeEach(() => {
    useCases.create.execute.mockResolvedValue(view);
    useCases.update.execute.mockResolvedValue(view);
    useCases.receive.execute.mockResolvedValue(view);
    useCases.approve.execute.mockResolvedValue(view);
  });

  it('SHOULD pass the caller reach (user + families) AND the user id to every write', async () => {
    const body = { netAmount: 1 } as never;

    expect((await setup.createIncome(userId, body)).item.id).toBe(id);
    await setup.updateIncome(userId, id, body);
    await setup.receiveIncome(userId, id, {});
    await setup.approveSuggestion(userId, id, {});

    for (const useCase of [useCases.create, useCases.update, useCases.receive, useCases.approve]) {
      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ accessibleOwners: owners, userId }),
      );
    }
    expect(useCases.update.execute).toHaveBeenCalledWith(expect.objectContaining({ id }));
  });

  it('SHOULD delete AND reject for the caller', async () => {
    await setup.deleteIncome(userId, id);
    await setup.rejectSuggestion(userId, id);

    expect(useCases.delete.execute).toHaveBeenCalledWith({ accessibleOwners: owners, id });
    expect(useCases.reject.execute).toHaveBeenCalledWith({ accessibleOwners: owners, id, userId });
  });
});

describe('reads', () => {
  it('SHOULD answer one income', async () => {
    useCases.findById.execute.mockResolvedValue(view);

    expect((await setup.findIncomeById(userId, id)).item.id).toBe(id);
  });

  it('SHOULD answer the defaults without the type', async () => {
    useCases.findDefaults.execute.mockResolvedValue({
      accountId: 'acc',
      categoryId: 'cat',
      currency: 'BRL',
      quantity: '300',
      type: 'JCP',
      withholdingRate: '0.15',
    });

    expect(await setup.findDefaults(userId, 'asset-1', { type: 'JCP' as never })).toEqual({
      accountId: 'acc',
      categoryId: 'cat',
      currency: 'BRL',
      quantity: '300',
      withholdingRate: '0.15',
    });
    expect(useCases.findDefaults.execute).toHaveBeenCalledWith({
      accessibleOwners: owners,
      assetId: 'asset-1',
      type: 'JCP',
    });
  });

  it('SHOULD answer the page with the summary only WHEN there is one', async () => {
    const summary = {
      currency: 'BRL',
      pendingSuggestions: 1,
      plannedTotal: 2,
      receivedThisYear: 3,
    };

    useCases.findIncomes.execute.mockResolvedValueOnce({ items: [view], nextCursor: 'c', summary });
    expect(await setup.findIncomes(userId, { assetId: 'asset-1' })).toMatchObject({
      items: [{ id }],
      nextCursor: 'c',
      summary,
    });

    useCases.findIncomes.execute.mockResolvedValueOnce({ items: [], nextCursor: null });
    expect(await setup.findIncomes(userId, { from: '2026-01-01', to: '2026-12-31' })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('SHOULD answer the suggestions with a count AND leave a missing payment date out', async () => {
    useCases.findSuggestions.execute.mockResolvedValue([
      mocks.suggestion,
      { ...mocks.suggestion, paymentDate: null },
    ]);

    const result = await setup.findSuggestions(userId, {});

    expect(result.count).toBe(2);
    expect(result.items[0]).toHaveProperty('paymentDate', '2026-12-19');
    expect(result.items[1]).not.toHaveProperty('paymentDate');
  });
});
