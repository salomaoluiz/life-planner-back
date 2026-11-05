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

it('SHOULD never mark a projected row as paid, even on a paid invoice (spec 096)', async () => {
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
      totals: [{ amount: 7000, invoiceMonth: '2026-09' }],
    },
  ]);
  const projectedRow = { ...mocks.closedRow, projected: true };

  const result = await setup.execute({ today: mocks.today, transactions: [projectedRow] });
  const onlyPaid = await setup.execute({
    paid: true,
    today: mocks.today,
    transactions: [projectedRow],
  });

  expect(result[0].paid).toBe(false);
  expect(onlyPaid).toEqual([]);
});

it('SHOULD mark a card row as paid WHEN its closed invoice has nothing to pay', async () => {
  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, payments: [], totals: [{ amount: 0, invoiceMonth: '2026-09' }] },
  ]);

  const result = await setup.execute({ today: mocks.today, transactions: [mocks.closedRow] });

  expect(result[0].paid).toBe(true);
});

it('SHOULD read all cards in ONE findCreditCardsByIds call AND skip the lookups WHEN there are only account rows', async () => {
  await setup.execute({ today: mocks.today, transactions: [mocks.openRow, mocks.closedRow] });
  expect(mocks.creditCardRepository.findCreditCardsByIds).toHaveBeenCalledTimes(1);
  expect(mocks.creditCardRepository.findCreditCardsByIds).toHaveBeenCalledWith([mocks.card.id]);
  expect(mocks.compute.execute).toHaveBeenCalledTimes(1);

  mocks.compute.execute.mockClear();
  await setup.execute({ today: mocks.today, transactions: [mocks.accountRow] });
  expect(mocks.compute.execute).not.toHaveBeenCalled();
});

it('SHOULD drop the card rows whose resolved status differs from the paid filter (spec 045)', async () => {
  const unpaid = await setup.execute({
    paid: false,
    today: mocks.today,
    transactions: [mocks.accountRow, mocks.openRow],
  });
  const paid = await setup.execute({
    paid: true,
    today: mocks.today,
    transactions: [mocks.accountRow, mocks.openRow],
  });

  expect(unpaid.map((row) => row.id)).toEqual([mocks.accountRow.id, mocks.openRow.id]);
  expect(paid.map((row) => row.id)).toEqual([mocks.accountRow.id]);
});

it('SHOULD skip the card and invoice reads WHEN invoiceData covers the cards of the rows (spec 083)', async () => {
  const result = await setup.execute({
    invoiceData: [
      {
        card: mocks.card,
        invoices: undefined as never,
        payments: [],
        totals: [
          { amount: 5000, invoiceMonth: '2026-10' },
          { amount: 0, invoiceMonth: '2026-09' },
        ],
      },
    ],
    today: mocks.today,
    transactions: [mocks.openRow, mocks.closedRow],
  });

  expect(result.map((row) => row.paid)).toEqual([false, true]);
  expect(mocks.creditCardRepository.findCreditCardsByIds).not.toHaveBeenCalled();
  expect(mocks.compute.execute).not.toHaveBeenCalled();
});

it('SHOULD compute only the cards missing from invoiceData (spec 083)', async () => {
  const otherCard = { ...mocks.card, id: 'other-card' };
  const otherRow = { ...mocks.openRow, creditCardId: 'other-card' };

  mocks.creditCardRepository.findCreditCardsByIds.mockResolvedValue([otherCard]);
  mocks.compute.execute.mockResolvedValue([
    { card: otherCard, payments: [], totals: [{ amount: 100, invoiceMonth: '2026-10' }] },
  ]);

  await setup.execute({
    invoiceData: [{ card: mocks.card, invoices: undefined as never, payments: [], totals: [] }],
    today: mocks.today,
    transactions: [mocks.openRow, otherRow],
  });

  expect(mocks.creditCardRepository.findCreditCardsByIds).toHaveBeenCalledWith(['other-card']);
  expect(mocks.compute.execute).toHaveBeenCalledWith({ cards: [otherCard], today: mocks.today });
});
