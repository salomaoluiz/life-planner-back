import { mocks, setup } from './index.mocks';

describe('ComputeCardInvoicesUseCase', () => {
  it('SHOULD return no data WITHOUT querying WHEN there are no cards', async () => {
    expect(await setup.execute({ cards: [], today: '2026-10-15' })).toEqual([]);
    expect(mocks.transactionRepository.sumCardInvoices).not.toHaveBeenCalled();
  });

  it('SHOULD use one sum query AND one payments query, split per card', async () => {
    const [data] = await setup.execute({ cards: [mocks.card], today: '2026-10-15' });

    expect(mocks.transactionRepository.sumCardInvoices).toHaveBeenCalledTimes(1);
    expect(mocks.paymentRepository.findByCardIds).toHaveBeenCalledTimes(1);
    expect(data.totals).toHaveLength(2);
    expect(data.payments[0].referenceMonth).toBe('2026-09');
    expect(data.invoices.used).toBe(45000);
    expect(data.invoices.openInvoice.amount).toBe(45000);
  });

  it('SHOULD reject an invalid today', async () => {
    await expect(setup.execute({ cards: [mocks.card], today: 'x' })).rejects.toThrow();
  });
});
