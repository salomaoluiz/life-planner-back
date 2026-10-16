import { mocks, setup } from './index.mocks';

it('SHOULD return the October invoice in NOVEMBER (planned payment day 05/11) with its purchases', async () => {
  const result = await setup.execute(mocks.input);

  expect(result).toHaveLength(1);
  expect(result[0].invoice).toMatchObject({ amount: 45000, listDate: '2026-11-05' });
  expect(result[0].purchases).toEqual([mocks.purchase]);
  expect(mocks.transactionRepository.findCardPurchases).toHaveBeenCalledTimes(1);
});

it('SHOULD NOT return it in October while it is unpaid', async () => {
  expect(await setup.execute({ ...mocks.input, month: '2026-10' })).toEqual([]);
  expect(mocks.transactionRepository.findCardPurchases).not.toHaveBeenCalled();
});

it('SHOULD move the line to the real payment day once paid (October, not November)', async () => {
  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, invoices: {}, payments: [mocks.payment], totals: mocks.totals },
  ]);

  expect(await setup.execute({ ...mocks.input, month: '2026-10' })).toHaveLength(1);
  expect(await setup.execute(mocks.input)).toEqual([]);
});

it('SHOULD skip invoices with amount 0', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      invoices: {},
      payments: [],
      totals: [{ amount: 0, invoiceMonth: '2026-10' }],
    },
  ]);

  expect(await setup.execute(mocks.input)).toEqual([]);
});

it('SHOULD return [] WITHOUT querying WHEN no requested owner is accessible', async () => {
  expect(await setup.execute({ ...mocks.input, ownerIds: ['stranger'] })).toEqual([]);
  expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
});

it('SHOULD reject a malformed month', async () => {
  await expect(setup.execute({ ...mocks.input, month: '2026-1' })).rejects.toThrow();
});
