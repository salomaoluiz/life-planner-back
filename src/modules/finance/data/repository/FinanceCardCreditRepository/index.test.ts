import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD create a refund with snake_case columns AND map the row', async () => {
  mocks.datasource.createRefund.mockResolvedValue(mocks.raw);

  const result = await setup.createRefund({
    categoryId: 'cat',
    creditCardId: 'card-1',
    date: '2026-10-16',
    description: 'Refund',
    invoiceMonth: '2026-10',
    maxLinked: 50000,
    owner: OwnerType.USER,
    ownerId: 'owner-1',
    refundedTransactionId: 'purchase-1',
    value: 20000,
  });

  expect(result.id).toBe('refund-1');
  expect(mocks.datasource.createRefund).toHaveBeenCalledWith(
    expect.objectContaining({
      invoice_month: '2026-10',
      max_linked: 50000,
      refunded_transaction_id: 'purchase-1',
    }),
  );
});

it('SHOULD update a refund, converting the date only WHEN it is sent', async () => {
  mocks.datasource.updateRefund.mockResolvedValue(mocks.raw);

  await setup.updateRefund({ id: 'refund-1', value: 5 });
  await setup.updateRefund({ date: '2026-10-17', id: 'refund-1' });

  expect(mocks.datasource.updateRefund.mock.calls[0][0].date).toBeUndefined();
  expect(mocks.datasource.updateRefund.mock.calls[1][0].date).toEqual(
    new Date('2026-10-17T00:00:00.000Z'),
  );
});

it('SHOULD create and update an early payment with the account of the debit row', async () => {
  mocks.datasource.createEarlyPayment.mockResolvedValue(mocks.raw);
  mocks.datasource.updateEarlyPayment.mockResolvedValue(mocks.raw);
  const account = { id: 'acc-1', owner: OwnerType.USER, ownerId: 'owner-1' };

  await setup.createEarlyPayment({
    account,
    accountCategoryId: 'inv',
    accountDescription: 'Early payment · Card (2026-10)',
    categoryId: 'early',
    creditCardId: 'card-1',
    date: '2026-10-16',
    description: 'Early payment',
    expectedNet: 100000,
    invoiceMonth: '2026-10',
    method: InvoicePaymentMethod.ACCOUNT,
    owner: OwnerType.USER,
    ownerId: 'owner-1',
    value: 60000,
  });
  await setup.updateEarlyPayment({ account, id: 'early-1', method: InvoicePaymentMethod.ACCOUNT });

  expect(mocks.datasource.createEarlyPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      account: { id: 'acc-1', owner: 'USER', owner_id: 'owner-1' },
      account_category_id: 'inv',
      expected_net: 100000,
    }),
  );
  expect(mocks.datasource.updateEarlyPayment).toHaveBeenCalledWith(
    expect.objectContaining({ account: { id: 'acc-1', owner: 'USER', owner_id: 'owner-1' } }),
  );
});

it('SHOULD delete and count through the datasource', async () => {
  mocks.datasource.countRefundsByPlanId.mockResolvedValue(1);
  mocks.datasource.countRefundsByTransactionId.mockResolvedValue(2);

  await setup.deleteCredit('refund-1');

  expect(mocks.datasource.deleteCredit).toHaveBeenCalledWith('refund-1');
  expect(await setup.countRefundsByPlanId('p')).toBe(1);
  expect(await setup.countRefundsByTransactionId('t')).toBe(2);
});
