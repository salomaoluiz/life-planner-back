import { mocks, setup } from './invoice.service.mocks';

describe('findForList', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('SHOULD default today to São Paulo AND map card and purchases to the API shape', async () => {
    const [result] = await setup.findForList(mocks.userId, '2026-11', ['o1']);

    expect(mocks.getInvoicesForList.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      filter: undefined,
      month: '2026-11',
      ownerIds: ['o1'],
      today: '2026-10-15',
    });
    expect(result.card).toMatchObject({ id: mocks.card.id, title: mocks.card.title });
    expect(result.purchases[0]).toMatchObject({
      category: mocks.purchase.category.name,
      description: mocks.purchase.description,
      id: mocks.purchase.id,
      value: mocks.purchase.value,
    });
    expect(result.invoice.amount).toBe(45000);
    expect(result.purchases[0].prepaid).toBe(false);
    expect(result.credits[0]).toMatchObject({
      id: mocks.refund.id,
      kind: 'REFUND',
      value: mocks.refund.value,
    });
  });

  it('SHOULD forward the filter AND expose the filtered totals (spec 045)', async () => {
    mocks.getInvoicesForList.execute.mockResolvedValueOnce([
      {
        ...(await mocks.getInvoicesForList.execute({}))[0],
        filtered: { filteredTotal: 41230, matchedCount: 3, purchaseCount: 14 },
      },
    ]);

    const [result] = await setup.findForList(mocks.userId, undefined, undefined, undefined, {
      from: '2025-01-01',
      to: '2025-02-28',
    });

    expect(mocks.getInvoicesForList.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: { from: '2025-01-01', to: '2025-02-28' } }),
    );
    expect(result).toMatchObject({ filteredTotal: 41230, matchedCount: 3, purchaseCount: 14 });
  });

  it('SHOULD forward the client today', async () => {
    await setup.findForList(mocks.userId, '2026-11', undefined, '2026-11-02');

    expect(mocks.getInvoicesForList.execute).toHaveBeenCalledWith(
      expect.objectContaining({ today: '2026-11-02' }),
    );
  });
});

describe('findOne', () => {
  it('SHOULD read one invoice of the card', async () => {
    const result = await setup.findOne(mocks.userId, mocks.card.id, '2026-10', '2026-11-02');

    expect(mocks.getInvoice.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      creditCardId: mocks.card.id,
      invoiceMonth: '2026-10',
      today: '2026-11-02',
    });
    expect(result.invoice.referenceMonth).toBe('2026-10');
  });
});

describe('pay / undo', () => {
  it('SHOULD default paidOn to today AND return the payment', async () => {
    const result = await setup.pay(
      mocks.userId,
      mocks.card.id,
      '2026-10',
      { method: 'EXTERNAL' as never },
      '2026-11-05',
    );

    expect(mocks.payInvoice.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      accountId: undefined,
      creditCardId: mocks.card.id,
      invoiceMonth: '2026-10',
      method: 'EXTERNAL',
      paidOn: '2026-11-05',
      today: '2026-11-05',
    });
    expect(result).toEqual(mocks.payment);
  });

  it('SHOULD use the sent paidOn', async () => {
    await setup.pay(
      mocks.userId,
      mocks.card.id,
      '2026-10',
      { accountId: 'acc', method: 'ACCOUNT' as never, paidOn: '2026-11-03' },
      '2026-11-05',
    );

    expect(mocks.payInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc', paidOn: '2026-11-03' }),
    );
  });

  it('SHOULD undo through the use case', async () => {
    await setup.undo(mocks.userId, mocks.card.id, '2026-10');

    expect(mocks.undoInvoicePayment.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      creditCardId: mocks.card.id,
      invoiceMonth: '2026-10',
    });
  });
});
