import { InvoiceStatus } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

describe('GetUpcomingItemsUseCase', () => {
  describe('account rows', () => {
    it('SHOULD ask for unpaid account rows from the beginning to today + days', async () => {
      await setup.execute(mocks.input);

      expect(mocks.transactionRepository.findUnpaidAccountRows).toHaveBeenCalledWith(
        mocks.input.accessibleOwners,
        '2026-11-19',
      );
    });

    it('SHOULD return a three-year-old unpaid row as overdue', async () => {
      mocks.transactionRepository.findUnpaidAccountRows.mockResolvedValue([
        mocks.row('2023-05-01'),
      ]);

      const result = await setup.execute(mocks.input);

      expect(result.overdue).toHaveLength(1);
      expect(result.overdue[0]).toMatchObject({ kind: 'TRANSACTION', valueCents: 1000 });
    });
  });

  describe('invoices', () => {
    it('SHOULD turn an open invoice into one item with its purchase count', async () => {
      mocks.findInvoices.execute.mockResolvedValue([
        { card: mocks.card, invoice: mocks.invoice() },
      ]);
      mocks.transactionRepository.countCardPurchasesByInvoice.mockResolvedValue([
        { count: 2, creditCardId: mocks.card.id, invoiceMonth: '2026-11' },
        { count: 7, creditCardId: mocks.card.id, invoiceMonth: '2026-10' },
      ]);

      const result = await setup.execute(mocks.input);

      expect(result.next).toEqual([
        expect.objectContaining({
          creditCardId: mocks.card.id,
          date: '2026-11-15',
          id: `${mocks.card.id}:2026-11`,
          invoiceMonth: '2026-11',
          kind: 'INVOICE',
          purchaseCount: 2,
          valueCents: 5000,
        }),
      ]);
    });

    it('SHOULD count 0 purchases WHEN the invoice key has no rows in the grouped result', async () => {
      mocks.findInvoices.execute.mockResolvedValue([
        { card: mocks.card, invoice: mocks.invoice() },
      ]);

      const result = await setup.execute(mocks.input);

      expect(mocks.transactionRepository.countCardPurchasesByInvoice).toHaveBeenCalledWith([
        { creditCardId: mocks.card.id, invoiceMonth: '2026-11' },
      ]);
      expect(result.next[0]).toMatchObject({ purchaseCount: 0 });
    });

    it('SHOULD leave out paid invoices and invoices with nothing due', async () => {
      mocks.findInvoices.execute.mockResolvedValue([
        { card: mocks.card, invoice: mocks.invoice({ status: InvoiceStatus.PAID }) },
        { card: mocks.card, invoice: mocks.invoice({ amountDue: 0, referenceMonth: '2026-10' }) },
      ]);

      const result = await setup.execute(mocks.input);

      expect(result.next).toHaveLength(0);
      expect(mocks.transactionRepository.countCardPurchasesByInvoice).not.toHaveBeenCalled();
    });

    it('SHOULD look for invoices over the whole past up to today + days', async () => {
      await setup.execute(mocks.input);

      expect(mocks.findInvoices.execute).toHaveBeenCalledWith(
        expect.objectContaining({ from: '1900-01-01', to: '2026-11-19', today: '2026-11-12' }),
      );
    });
  });

  describe('projections', () => {
    it('SHOULD NOT project while the window stays inside the current month', async () => {
      await setup.execute({ ...mocks.input, today: '2026-11-10' });

      expect(mocks.projections.execute).not.toHaveBeenCalled();
    });

    it('SHOULD project across the month end, account series only, up to today + days', async () => {
      const base = {
        account: { icon: 'bank', id: 'account-a', name: 'A' },
        category: { id: 'cat' },
        creditCard: null,
        currency: 'BRL',
        description: 'Gym',
        owner: 'USER',
        ownerId: 'user-a',
        recurrenceId: 'rec',
        type: 'EXPENSE',
        value: 9990,
      };

      mocks.projections.execute.mockResolvedValue([
        { ...base, date: '2026-12-01', occurrenceNumber: 4 },
        { ...base, creditCard: { id: 'card' }, date: '2026-12-02', occurrenceNumber: 5 },
        { ...base, date: '2026-12-09', occurrenceNumber: 6 },
      ]);

      const result = await setup.execute({ ...mocks.input, today: '2026-11-28' });

      expect(mocks.projections.execute).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-11', to: '2026-12', today: '2026-11-28' }),
      );
      expect(result.next).toEqual([
        expect.objectContaining({ id: 'rec:4', kind: 'PROJECTION', valueCents: 9990 }),
      ]);
    });
  });

  it('SHOULD return empty lists, without reading, when the filter reaches no owner', async () => {
    const result = await setup.execute({ ...mocks.input, ownerIds: ['someone-else'] });

    expect(result).toEqual({
      next: [],
      nextTotal: 0,
      overdue: [],
      overdueTotals: { expenseCents: 0, incomeCents: 0 },
    });
    expect(mocks.transactionRepository.findUnpaidAccountRows).not.toHaveBeenCalled();
  });

  it('SHOULD cut next to the limit and keep every overdue item', async () => {
    mocks.transactionRepository.findUnpaidAccountRows.mockResolvedValue([
      mocks.row('2026-11-01', { id: 'o1' }),
      mocks.row('2026-11-02', { id: 'o2' }),
      ...['12', '13', '14'].map((day) => mocks.row(`2026-11-${day}`, { id: `n${day}` })),
    ]);

    const result = await setup.execute({ ...mocks.input, limit: 2 });

    expect(result.overdue).toHaveLength(2);
    expect(result.next).toHaveLength(2);
    expect(result.nextTotal).toBe(3);
  });
});
