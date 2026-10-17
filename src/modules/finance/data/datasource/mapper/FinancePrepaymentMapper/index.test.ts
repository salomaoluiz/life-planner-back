import { FinancePrepaymentMapper } from './index';

const raw = {
  created_at: new Date('2026-10-16T12:00:00.000Z'),
  date: new Date('2026-10-16T00:00:00.000Z'),
  discount_transaction: { value: 12000 },
  discount_transaction_id: 'discount-1',
  id: 'prepayment-1',
  installment_plan_id: 'plan-1',
  original_months: { 'tx-4': '2026-11' },
  owner: 'USER' as const,
  owner_id: 'owner-1',
  target_invoice_month: '2026-10',
  updated_at: new Date('2026-10-16T13:00:00.000Z'),
};

it('SHOULD map the columns AND the discount value', () => {
  expect(FinancePrepaymentMapper.toDomain(raw)).toMatchObject({
    date: '2026-10-16',
    discount: 12000,
    installmentPlanId: 'plan-1',
    originalMonths: { 'tx-4': '2026-11' },
    targetInvoiceMonth: '2026-10',
  });
});

it('SHOULD report discount 0 WHEN there is no discount row', () => {
  expect(
    FinancePrepaymentMapper.toDomain({
      ...raw,
      discount_transaction: null,
      discount_transaction_id: null,
    }).discount,
  ).toBe(0);
});
