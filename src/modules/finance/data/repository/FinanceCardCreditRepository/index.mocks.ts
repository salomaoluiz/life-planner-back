import { Test } from '@nestjs/testing';

import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';

import { FinanceCardCreditRepository } from './index';

// region Mocks

const rawMock: FinancialTransactionWithRelations = {
  account: null,
  account_id: null,
  category: {
    exclude_from_totals: false,
    icon: 'cash',
    icon_color: '#4CAF50',
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Refund',
    system_key: 'CARD_REFUND',
  },
  category_id: '00000000-0000-4000-8000-000000000004',
  created_at: new Date('2026-10-16T12:00:00.000Z'),
  credit_card: { color: '#2B3A8C', id: 'card-1', last_digits: null, title: 'Card' },
  credit_card_id: 'card-1',
  currency: 'BRL' as const,
  date: new Date('2026-10-16T00:00:00.000Z'),
  description: 'Refund',
  early_payment: null,
  id: 'refund-1',
  installment_number: null,
  installment_plan: null,
  installment_plan_id: null,
  invoice_month: '2026-10',
  occurrence_number: null,
  owner: 'USER',
  owner_id: 'owner-1',
  paid: true,
  paid_from_transaction: null,
  paid_from_transaction_id: null,
  payment_method: null,
  prepayment_id: null,
  recurrence: null,
  recurrence_id: null,
  refunded_plan: null,
  refunded_plan_id: null,
  refunded_transaction: null,
  refunded_transaction_id: null,
  type: 'INCOME',
  updated_at: new Date('2026-10-16T13:00:00.000Z'),
  value: 20000,
};
const datasourceMock = {
  countRefundsByPlanId: jest.fn(),
  countRefundsByTransactionId: jest.fn(),
  createEarlyPayment: jest.fn(),
  createImportRows: jest.fn(),
  createRefund: jest.fn(),
  deleteCredit: jest.fn(),
  updateEarlyPayment: jest.fn(),
  updateRefund: jest.fn(),
};

// endregion Mocks

let setup: FinanceCardCreditRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      FinanceCardCreditRepository,
      { provide: 'IFinanceCardCreditDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceCardCreditRepository);
});

const mocks = { datasource: datasourceMock, raw: rawMock };
const spies = {};

export { mocks, setup, spies };
