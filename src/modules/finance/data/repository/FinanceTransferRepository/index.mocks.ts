import { Test } from '@nestjs/testing';

import { WriteTransferRepositoryParams } from '@finance/domain/repository';

import { FinanceTransferRepository } from './index';

// region Mocks

const record = {
  amount_in: 92000,
  amount_out: 500000,
  created_at: new Date('2026-11-04T10:00:00.000Z'),
  created_by: 'user-1',
  currency_in: 'USD',
  currency_out: 'BRL',
  date_in: new Date('2026-11-06T00:00:00.000Z'),
  date_out: new Date('2026-11-04T00:00:00.000Z'),
  description: 'Send',
  fee: null,
  from_account_id: 'acc-b',
  id: 'transfer-1',
  notes: null,
  occurrence_number: null,
  paid: true,
  recurrence_id: null,
  to_account_id: 'acc-a',
  transactions: [
    { category_id: '00000000-0000-4000-8000-000000000006', id: 'row-out' },
    { category_id: '00000000-0000-4000-8000-000000000007', id: 'row-in' },
  ],
  updated_at: new Date('2026-11-04T10:00:00.000Z'),
};
const params: WriteTransferRepositoryParams = {
  amountIn: 92000,
  amountOut: 500000,
  createdBy: 'user-1',
  dateIn: '2026-11-06',
  dateOut: '2026-11-04',
  description: 'Send',
  fee: null,
  from: { accountId: 'acc-b', currency: 'BRL', owner: 'USER' as never, ownerId: 'user-1' },
  notes: null,
  paid: true,
  to: { accountId: 'acc-a', currency: 'USD', owner: 'USER' as never, ownerId: 'user-1' },
};

// endregion Mocks

const datasourceMock = {
  create: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
};

let setup: FinanceTransferRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    providers: [
      FinanceTransferRepository,
      { provide: 'IFinanceTransferDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceTransferRepository);
});

const mocks = { params, record };
const spies = datasourceMock;

export { mocks, setup, spies };
