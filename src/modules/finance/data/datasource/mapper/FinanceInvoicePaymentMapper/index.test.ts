import { InvoicePaymentMethod } from '@finance/domain/enum';

import { FinanceInvoicePaymentMapper } from './index';

describe('FinanceInvoicePaymentMapper.toDomain', () => {
  const raw = {
    account: { name: 'Checking' },
    account_id: 'acc-1',
    amount: 100,
    created_at: new Date('2026-11-05T10:00:00.000Z'),
    credit_card_id: 'card-1',
    id: 'p-1',
    invoice_month: '2026-10',
    method: 'ACCOUNT' as const,
    owner: 'USER' as const,
    owner_id: 'owner-1',
    paid_on: new Date('2026-11-05T00:00:00.000Z'),
    transaction_id: 'tx-1',
    updated_at: new Date('2026-11-05T10:00:00.000Z'),
  };

  it('SHOULD map the columns AND the paid date to YYYY-MM-DD', () => {
    expect(FinanceInvoicePaymentMapper.toDomain(raw)).toMatchObject({
      accountName: 'Checking',
      method: InvoicePaymentMethod.ACCOUNT,
      paidOn: '2026-11-05',
      transactionId: 'tx-1',
    });
  });

  it('SHOULD map an external payment without account', () => {
    expect(
      FinanceInvoicePaymentMapper.toDomain({
        ...raw,
        account: null,
        account_id: null,
        method: 'EXTERNAL',
        transaction_id: null,
      }),
    ).toMatchObject({ accountId: null, accountName: null, transactionId: null });
  });
});
