import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AccountStatus, InvoicePaymentMethod } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

it('SHOULD allow a bigger value up to the amount due plus its own value (100.000 here)', async () => {
  await setup.execute({ ...mocks.input, value: 100000 });

  expect(mocks.cardCreditRepository.updateEarlyPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      account: undefined,
      expectedNet: 40000,
      id: mocks.payment.id,
      value: 100000,
    }),
  );
  await expect(setup.execute({ ...mocks.input, value: 100001 })).rejects.toThrow(
    "The value can't exceed what is left to pay",
  );
});

it('SHOULD keep the same account WITHOUT looking it up WHEN only the value changes', async () => {
  await setup.execute({ ...mocks.input, value: 50000 });

  expect(mocks.accountRepository.findAccountById).not.toHaveBeenCalled();
});

it('SHOULD check the new account WHEN the account changes', async () => {
  await setup.execute({ ...mocks.input, accountId: mocks.otherAccount.id });

  expect(mocks.cardCreditRepository.updateEarlyPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      account: {
        id: mocks.otherAccount.id,
        owner: mocks.otherAccount.owner,
        ownerId: mocks.otherAccount.ownerId,
      },
    }),
  );

  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.otherAccount,
    status: AccountStatus.ARCHIVED,
  });
  await expect(setup.execute({ ...mocks.input, accountId: mocks.otherAccount.id })).rejects.toThrow(
    'Account is archived',
  );

  mocks.accountRepository.findAccountById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...mocks.input, accountId: mocks.otherAccount.id })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD switch to a boleto WITHOUT an account AND refuse an accountId with it', async () => {
  await setup.execute({ ...mocks.input, method: InvoicePaymentMethod.EXTERNAL });

  expect(mocks.cardCreditRepository.updateEarlyPayment).toHaveBeenCalledWith(
    expect.objectContaining({ account: undefined, method: InvoicePaymentMethod.EXTERNAL }),
  );
  await expect(
    setup.execute({
      ...mocks.input,
      accountId: mocks.otherAccount.id,
      method: InvoicePaymentMethod.EXTERNAL,
    }),
  ).rejects.toThrow(BadRequestException);
});

it('SHOULD need an account WHEN a boleto payment becomes an account payment', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValue({
    ...mocks.payment,
    paidFromAccountId: null,
    paidFromTransactionId: null,
    paymentMethod: InvoicePaymentMethod.EXTERNAL,
  });

  await expect(
    setup.execute({ ...mocks.input, method: InvoicePaymentMethod.ACCOUNT }),
  ).rejects.toThrow('accountId is required');

  await setup.execute({
    ...mocks.input,
    accountId: mocks.otherAccount.id,
    method: InvoicePaymentMethod.ACCOUNT,
  });
  expect(mocks.cardCreditRepository.updateEarlyPayment).toHaveBeenCalledTimes(1);
});

it('SHOULD answer 400 for a date after today', async () => {
  await expect(setup.execute({ ...mocks.input, date: '2026-10-17' })).rejects.toThrow(
    BadRequestException,
  );
});

describe('paid invoice', () => {
  beforeEach(() =>
    mocks.compute.execute.mockResolvedValue([
      { card: mocks.card, payments: [{ referenceMonth: '2026-10' }], totals: [] },
    ]),
  );

  it('SHOULD allow only the description', async () => {
    await setup.execute({ ...mocks.input, description: 'Renamed' });

    expect(mocks.cardCreditRepository.updateEarlyPayment).toHaveBeenCalledWith({
      description: 'Renamed',
      id: mocks.payment.id,
    });
  });

  it('SHOULD answer 422 for any other change', async () => {
    await expect(setup.execute({ ...mocks.input, value: 1 })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

it('SHOULD move to another assignable invoice WITH its own cap AND refuse an upcoming one', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      payments: [],
      totals: [
        { amount: 40000, earlyPaid: 60000, invoiceMonth: '2026-10' },
        { amount: 30000, invoiceMonth: '2026-11' },
      ],
    },
  ]);

  await setup.execute({ ...mocks.input, invoiceMonth: '2026-11', value: 30000 });
  await expect(
    setup.execute({ ...mocks.input, invoiceMonth: '2026-11', value: 30001 }),
  ).rejects.toThrow(UnprocessableEntityException);
  await expect(setup.execute({ ...mocks.input, invoiceMonth: '2026-12' })).rejects.toThrow(
    'Invoice is paid or not open yet',
  );
});

it('SHOULD answer 404 WHEN the payment is missing, of another card or not an early payment', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.payment,
    category: { ...mocks.payment.category, systemKey: null },
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { ...mocks.input, value: 100000 };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
