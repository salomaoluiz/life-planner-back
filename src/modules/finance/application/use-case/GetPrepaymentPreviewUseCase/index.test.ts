import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD list the installments after the target invoice AND their total', async () => {
  const result = await setup.execute(mocks.input);

  expect(result.eligible.map((row) => row.installmentNumber)).toEqual([2, 3]);
  expect(result.total).toBe(6666);
  expect(result.card).toBe(mocks.card);
});

it('SHOULD leave out installments whose invoice has a payment record', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      payments: [{ referenceMonth: '2026-12' }],
      totals: [],
    },
  ]);

  const result = await setup.execute(mocks.input);

  expect(result.eligible.map((row) => row.installmentNumber)).toEqual([2]);
});

it('SHOULD answer 422 WHEN the target is paid, upcoming, or nothing is after it', async () => {
  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, payments: [{ referenceMonth: '2026-10' }], totals: [] },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);

  mocks.compute.execute.mockResolvedValue([{ card: mocks.card, payments: [], totals: [] }]);
  await expect(setup.execute({ ...mocks.input, targetInvoiceMonth: '2027-06' })).rejects.toThrow(
    UnprocessableEntityException,
  );

  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, payments: [{ referenceMonth: '2026-12' }], totals: [] },
  ]);
  await expect(setup.execute({ ...mocks.input, targetInvoiceMonth: '2026-11' })).rejects.toThrow(
    'No installment to prepay',
  );
});

it('SHOULD answer 409 WHEN the plan already has a prepayment', async () => {
  mocks.planRepository.findPlanById.mockResolvedValue({
    ...mocks.plan,
    prepayment: { date: '2026-10-16', discount: 0, id: 'p', targetInvoiceMonth: '2026-10' },
  });

  await expect(setup.execute(mocks.input)).rejects.toThrow(ConflictException);
});

it('SHOULD answer 404 WHEN the plan or the card is missing or not accessible', async () => {
  mocks.planRepository.findPlanById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );

  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});
