import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AccountStatus, InvoicePaymentMethod } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

it('SHOULD create the early payment from an account with the account row description AND the net seen', async () => {
  await setup.execute(mocks.input);

  expect(mocks.cardCreditRepository.createEarlyPayment).toHaveBeenCalledWith({
    account: { id: mocks.account.id, owner: mocks.account.owner, ownerId: mocks.account.ownerId },
    accountCategoryId: '00000000-0000-4000-8000-000000000002',
    accountDescription: `Early payment · ${mocks.card.title} (2026-10)`,
    categoryId: '00000000-0000-4000-8000-000000000005',
    creditCardId: mocks.card.id,
    date: '2026-10-16',
    description: 'Early payment',
    expectedNet: 100000,
    invoiceMonth: '2026-10',
    method: InvoicePaymentMethod.ACCOUNT,
    owner: mocks.card.owner,
    ownerId: mocks.card.ownerId,
    value: 60000,
  });
});

it('SHOULD create a boleto payment WITHOUT touching accounts', async () => {
  await setup.execute({
    ...mocks.input,
    accountId: undefined,
    method: InvoicePaymentMethod.EXTERNAL,
  });

  expect(mocks.accountRepository.findAccountById).not.toHaveBeenCalled();
  expect(mocks.cardCreditRepository.createEarlyPayment).toHaveBeenCalledWith(
    expect.objectContaining({ account: undefined, method: InvoicePaymentMethod.EXTERNAL }),
  );
});

it('SHOULD accept paying the whole amount due AND answer 422 above it', async () => {
  await setup.execute({ ...mocks.input, value: 100000 });
  await expect(setup.execute({ ...mocks.input, value: 100001 })).rejects.toThrow(
    "The value can't exceed what is left to pay",
  );
});

it('SHOULD answer 400 WHEN the date is after today OR accountId does not match the method', async () => {
  await expect(setup.execute({ ...mocks.input, date: '2026-10-17' })).rejects.toThrow(
    BadRequestException,
  );
  await expect(setup.execute({ ...mocks.input, accountId: undefined })).rejects.toThrow();
  await expect(
    setup.execute({ ...mocks.input, method: InvoicePaymentMethod.EXTERNAL }),
  ).rejects.toThrow();
});

it('SHOULD answer 422 WHEN the invoice is paid or upcoming, or the card or account is archived', async () => {
  mocks.compute.execute.mockResolvedValueOnce([
    { card: mocks.card, payments: [{ referenceMonth: '2026-10' }], totals: [] },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);

  await expect(setup.execute({ ...mocks.input, invoiceMonth: '2026-12' })).rejects.toThrow(
    UnprocessableEntityException,
  );

  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce({
    ...mocks.card,
    status: AccountStatus.ARCHIVED,
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow('Credit card is archived');

  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    status: AccountStatus.ARCHIVED,
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow('Account is archived');
});

it('SHOULD answer 404 WHEN the card or the account is missing or not accessible', async () => {
  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );

  mocks.accountRepository.findAccountById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow('Account not found');

  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    ownerId: 'stranger',
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow('Account not found');
});
