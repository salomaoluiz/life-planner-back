import { mocks, setup } from './index.mocks';

it('SHOULD mark a card row of an open invoice as unpaid AND keep the order and the account rows', async () => {
  const result = await setup.execute({
    today: mocks.today,
    transactions: [mocks.accountRow, mocks.openRow, mocks.closedRow],
  });

  expect(result.map((row) => row.id)).toEqual([
    mocks.accountRow.id,
    mocks.openRow.id,
    mocks.closedRow.id,
  ]);
  expect(result.map((row) => row.paid)).toEqual([false, false, false]);
  expect(result[0]).toBe(mocks.accountRow);
});

it('SHOULD mark a card row as paid WHEN its invoice has a payment record', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      payments: [
        {
          accountId: null,
          accountName: null,
          amount: 7000,
          method: 'BOLETO',
          paidOn: '2026-10-10',
          referenceMonth: '2026-09',
        },
      ],
      totals: [
        { amount: 5000, invoiceMonth: '2026-10' },
        { amount: 7000, invoiceMonth: '2026-09' },
      ],
    },
  ]);

  const result = await setup.execute({
    today: mocks.today,
    transactions: [mocks.openRow, mocks.closedRow],
  });

  expect(result.map((row) => row.paid)).toEqual([false, true]);
});

it('SHOULD mark a card row as paid WHEN its closed invoice has nothing to pay', async () => {
  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, payments: [], totals: [{ amount: 0, invoiceMonth: '2026-09' }] },
  ]);

  const result = await setup.execute({ today: mocks.today, transactions: [mocks.closedRow] });

  expect(result[0].paid).toBe(true);
});

it('SHOULD read each card once AND skip the lookups WHEN there are only account rows', async () => {
  await setup.execute({ today: mocks.today, transactions: [mocks.openRow, mocks.closedRow] });
  expect(mocks.creditCardRepository.findCreditCardById).toHaveBeenCalledTimes(1);
  expect(mocks.compute.execute).toHaveBeenCalledTimes(1);

  mocks.compute.execute.mockClear();
  await setup.execute({ today: mocks.today, transactions: [mocks.accountRow] });
  expect(mocks.compute.execute).not.toHaveBeenCalled();
});
