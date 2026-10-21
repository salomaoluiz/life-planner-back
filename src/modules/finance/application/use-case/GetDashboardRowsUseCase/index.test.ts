import { mocks, setup } from './index.mocks';

describe('GetDashboardRowsUseCase', () => {
  it('SHOULD return nothing without owners', async () => {
    expect(await setup.execute({ ...mocks.input, accessibleOwners: [] })).toEqual([]);
    expect(mocks.transactionRepository.sumDashboardRows).not.toHaveBeenCalled();
  });

  it('SHOULD count paid account rows as realized on their date', async () => {
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([mocks.sumOf({})]);

    expect(await setup.execute(mocks.input)).toEqual([
      expect.objectContaining({ amount: 1000, bucketDate: '2026-10-05', projected: false }),
    ]);
  });

  it('SHOULD project unpaid rows of the current month AND drop unpaid rows of earlier months', async () => {
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([
      mocks.sumOf({ date: '2026-10-25', paid: false }),
      mocks.sumOf({ date: '2026-09-25', paid: false }),
    ]);

    expect(await setup.execute(mocks.input)).toEqual([
      expect.objectContaining({ bucketDate: '2026-10-25', projected: true }),
    ]);
  });

  it('SHOULD keep only realized rows with paid = true AND only projected with paid = false', async () => {
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([
      mocks.sumOf({ date: '2026-10-05', paid: true }),
      mocks.sumOf({ date: '2026-10-25', paid: false }),
    ]);

    const realized = await setup.execute({ ...mocks.input, filter: { paid: true } });
    const projected = await setup.execute({ ...mocks.input, filter: { paid: false } });

    expect(realized.map((row) => row.projected)).toEqual([false]);
    expect(projected.map((row) => row.projected)).toEqual([true]);
  });

  it('SHOULD count a card purchase on the day its invoice was paid', async () => {
    mocks.compute.execute.mockResolvedValue([
      {
        card: mocks.card,
        invoices: {},
        payments: [
          {
            accountId: null,
            accountName: null,
            amount: 5000,
            method: 'EXTERNAL',
            paidOn: '2026-10-10',
            referenceMonth: '2026-09',
          },
        ],
        totals: [{ amount: 5000, invoiceMonth: '2026-09' }],
      },
    ]);
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([
      mocks.sumOf({ creditCardId: mocks.card.id, date: null, invoiceMonth: '2026-09', paid: null }),
    ]);

    const rows = await setup.execute({ ...mocks.input, from: '2026-10-01' });

    expect(rows).toEqual([expect.objectContaining({ bucketDate: '2026-10-10', projected: false })]);
    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceRefs: [{ creditCardId: mocks.card.id, invoiceMonth: '2026-09' }],
      }),
    );
  });

  it('SHOULD project an unpaid invoice of the current month AND skip an unpaid one of an earlier month', async () => {
    mocks.compute.execute.mockResolvedValue([
      {
        card: mocks.card,
        invoices: {},
        payments: [],
        totals: [
          { amount: 4000, invoiceMonth: '2026-10' },
          { amount: 3000, invoiceMonth: '2026-03' },
        ],
      },
    ]);
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([]);

    await setup.execute(mocks.input);

    const refs = mocks.transactionRepository.sumDashboardRows.mock.calls[0][0].invoiceRefs;

    expect(refs.map((ref: { invoiceMonth: string }) => ref.invoiceMonth)).not.toContain('2026-03');
  });

  it('SHOULD not read the cards for the ACCOUNT source AND narrow the sources by the chosen ids', async () => {
    await setup.execute({ ...mocks.input, filter: { accountIds: ['acc-1'] } });

    expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ACCOUNT' }),
    );

    await setup.execute({ ...mocks.input, filter: { creditCardIds: ['card-1'] } });

    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'CARD' }),
    );
  });

  it('SHOULD expand the chosen categories to their descendants', async () => {
    mocks.expand.execute.mockResolvedValue(['cat-1', 'cat-2']);

    await setup.execute({ ...mocks.input, filter: { categoryIds: ['cat-1'] } });

    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['cat-1', 'cat-2'] }),
    );
  });
});
