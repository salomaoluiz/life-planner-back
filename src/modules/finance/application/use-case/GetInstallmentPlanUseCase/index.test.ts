import { NotFoundException } from '@nestjs/common';

import { InvoiceStatus } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

it('SHOULD list the installments with the status of their invoice AND report the SUM as the total', async () => {
  const result = await setup.execute(mocks.input);

  expect(result.plan.totalValue).toBe(10000);
  expect(result.installments).toEqual([
    {
      id: mocks.plan.installments[0].id,
      installmentNumber: 1,
      invoiceMonth: '2026-10',
      invoiceStatus: InvoiceStatus.PAID,
      value: 3334,
    },
    expect.objectContaining({ installmentNumber: 2, invoiceStatus: InvoiceStatus.OPEN }),
    expect.objectContaining({ installmentNumber: 3, invoiceStatus: InvoiceStatus.OPEN }),
  ]);
});

it('SHOULD answer 404 WHEN the plan does not exist or the caller has no access to its owner', async () => {
  mocks.planRepository.findPlanById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD answer 404 WHEN the card is gone', async () => {
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});

it('SHOULD mark an unpaid invoice that already closed as CLOSED', async () => {
  const result = await setup.execute({ ...mocks.input, today: '2026-12-05' });

  expect(result.installments[1].invoiceStatus).toBe(InvoiceStatus.CLOSED);
});
