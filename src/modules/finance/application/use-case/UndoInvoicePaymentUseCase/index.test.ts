import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD undo the payment of the invoice', async () => {
  await setup.execute(mocks.input);

  expect(mocks.invoicePaymentRepository.undoPayment).toHaveBeenCalledWith(mocks.card.id, '2026-10');
});

it('SHOULD throw NotFound (404) WHEN the card is not accessible', async () => {
  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
  expect(mocks.invoicePaymentRepository.undoPayment).not.toHaveBeenCalled();
});

it('SHOULD throw NotFound (404) WHEN the invoice is not paid', async () => {
  mocks.invoicePaymentRepository.findByCardAndMonth.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.invoicePaymentRepository.undoPayment).not.toHaveBeenCalled();
});
