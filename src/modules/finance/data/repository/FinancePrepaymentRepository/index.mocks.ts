import { Test } from '@nestjs/testing';

import { FinancialPrepaymentWithDiscount } from '@finance/data/repository/datasource/IFinancePrepaymentDatasource';

import { FinancePrepaymentRepository } from './index';

// region Mocks

const rawMock: FinancialPrepaymentWithDiscount = {
  created_at: new Date('2026-10-16T12:00:00.000Z'),
  date: new Date('2026-10-16T00:00:00.000Z'),
  discount_transaction: { value: 12000 },
  discount_transaction_id: 'discount-1',
  id: 'prepayment-1',
  installment_plan_id: 'plan-1',
  original_months: { 'tx-4': '2026-11' },
  owner: 'USER',
  owner_id: 'owner-1',
  target_invoice_month: '2026-10',
  updated_at: new Date('2026-10-16T13:00:00.000Z'),
};
const datasourceMock = { findByPlanId: jest.fn(), prepay: jest.fn(), undo: jest.fn() };

// endregion Mocks

let setup: FinancePrepaymentRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      FinancePrepaymentRepository,
      { provide: 'IFinancePrepaymentDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get(FinancePrepaymentRepository);
});

const mocks = { datasource: datasourceMock, raw: rawMock };
const spies = {};

export { mocks, setup, spies };
