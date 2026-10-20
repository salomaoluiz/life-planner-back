import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { InvoicePaymentMethod } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD pay the amount stored on the invoice from the account, taking the card owner for the record', async () => {
  const result = await setup.execute(mocks.input);

  expect(result).toEqual({ id: 'payment-1' });
  expect(mocks.invoicePaymentRepository.payInvoice).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: mocks.account.id,
      accountOwner: { owner: mocks.account.owner, ownerId: mocks.account.ownerId },
      amount: 45000,
      categoryId: '00000000-0000-4000-8000-000000000002',
      creditCardId: mocks.card.id,
      description: 'Invoice payment',
      invoiceMonth: '2026-10',
      method: InvoicePaymentMethod.ACCOUNT,
      owner: mocks.card.owner,
      ownerId: mocks.card.ownerId,
      paidOn: '2026-11-05',
    }),
  );
});

it('SHOULD pay by boleto WITHOUT looking up an account', async () => {
  await setup.execute({
    ...mocks.input,
    accountId: undefined,
    method: InvoicePaymentMethod.EXTERNAL,
  });

  expect(mocks.accountRepository.findAccountById).not.toHaveBeenCalled();
  expect(mocks.invoicePaymentRepository.payInvoice).toHaveBeenCalledWith(
    expect.objectContaining({ accountOwner: undefined, method: InvoicePaymentMethod.EXTERNAL }),
  );
});

it('SHOULD throw Unprocessable (422) WHEN the invoice is still open', async () => {
  await expect(setup.execute({ ...mocks.input, today: '2026-10-15' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(mocks.invoicePaymentRepository.payInvoice).not.toHaveBeenCalled();
});

it('SHOULD throw Unprocessable (422) WHEN the closed invoice has amount 0', async () => {
  mocks.compute.execute.mockResolvedValueOnce([{ ...mocks.data[0], totals: [] }]);

  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD throw Conflict (409) WHEN the invoice is already paid', async () => {
  mocks.compute.execute.mockResolvedValueOnce([
    {
      ...mocks.data[0],
      payments: [
        {
          accountId: null,
          accountName: null,
          amount: 45000,
          method: InvoicePaymentMethod.EXTERNAL,
          paidOn: '2026-11-03',
          referenceMonth: '2026-10',
        },
      ],
    },
  ]);

  await expect(setup.execute(mocks.input)).rejects.toThrow(ConflictException);
});

it.each([
  ['the card is missing', () => mocks.creditCardRepository.findCreditCardById],
  ['the account is missing', () => mocks.accountRepository.findAccountById],
])('SHOULD throw NotFound (404) WHEN %s', async (_label, spy) => {
  spy().mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.invoicePaymentRepository.payInvoice).not.toHaveBeenCalled();
});

it('SHOULD throw Unprocessable (422) WHEN the paying account is archived', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    status: 'ARCHIVED',
  });

  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD accept an account of ANOTHER owner the caller can access', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    owner: 'FAMILY',
    ownerId: 'family-id',
  });

  await expect(
    setup.execute({
      ...mocks.input,
      accessibleOwners: [
        ...mocks.input.accessibleOwners,
        { owner: 'FAMILY' as never, ownerId: 'family-id' },
      ],
    }),
  ).resolves.toBeDefined();
});

it.each([
  ['ACCOUNT without accountId', { accountId: undefined }],
  ['EXTERNAL with accountId', { method: InvoicePaymentMethod.EXTERNAL }],
  ['a malformed month', { invoiceMonth: '2026-13' }],
])('SHOULD throw ValidationError for %s', async (_label, patch) => {
  await expect(setup.execute({ ...mocks.input, ...patch })).rejects.toThrow(ValidationError);
});

it('SHOULD throw Unprocessable (422) WHEN the paying account is in another currency than the card', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    currency: 'USD',
  });

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new UnprocessableEntityException('Account currency must match the credit card currency'),
  );
  expect(mocks.invoicePaymentRepository.payInvoice).not.toHaveBeenCalled();
});

it('SHOULD write the payment row in the currency of the card', async () => {
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce({
    ...mocks.card,
    currency: 'USD',
  });
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    currency: 'USD',
  });

  await setup.execute(mocks.input);

  expect(mocks.invoicePaymentRepository.payInvoice).toHaveBeenCalledWith(
    expect.objectContaining({ currency: 'USD' }),
  );
});
