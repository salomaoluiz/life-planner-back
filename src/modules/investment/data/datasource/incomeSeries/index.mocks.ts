import { Prisma } from '@db/client';

export const spies = {
  assetFindUnique: jest.fn(),
  incomeDeleteMany: jest.fn(),
  incomeFindMany: jest.fn(),
  incomeUpdate: jest.fn(),
  operationFindMany: jest.fn(),
  seriesFindMany: jest.fn(),
  seriesUpdate: jest.fn(),
  transactionDeleteMany: jest.fn(),
  transactionUpdate: jest.fn(),
};

export const tx = {
  financialTransaction: {
    deleteMany: spies.transactionDeleteMany,
    update: spies.transactionUpdate,
  },
  investmentAsset: { findUnique: spies.assetFindUnique },
  investmentIncome: {
    deleteMany: spies.incomeDeleteMany,
    findMany: spies.incomeFindMany,
    update: spies.incomeUpdate,
  },
  investmentIncomeSeries: { findMany: spies.seriesFindMany, update: spies.seriesUpdate },
  investmentOperation: { findMany: spies.operationFindMany },
} as unknown as Prisma.TransactionClient;

function operation(date: string, type: 'BUY' | 'SELL', quantity: string, id: string) {
  return {
    bonus_percent: null,
    bonus_unit_cost: null,
    cash_cost: null,
    conversion_cost: null,
    created_at: new Date('2024-12-01T00:00:00Z'),
    date: new Date(`${date}T00:00:00Z`),
    fraction_cost: null,
    fraction_of_operation_id: null,
    fraction_quantity: null,
    id,
    quantity: new Prisma.Decimal(quantity),
    ratio_from: null,
    ratio_to: null,
    total: 1000,
    type,
  };
}

export const mocks = {
  buy: operation('2024-12-01', 'BUY', '100', 'op-1'),
  operation,
  planned: (number: number, paymentDate: string, exDate: string, net = 11000) => ({
    ex_date: new Date(`${exDate}T00:00:00Z`),
    id: `inc-${number}`,
    net_amount: net,
    occurrence_number: number,
    payment_date: new Date(`${paymentDate}T00:00:00Z`),
    quantity: new Prisma.Decimal('100'),
    transaction_id: `tx-${number}`,
  }),
  series: {
    amount_per_unit: new Prisma.Decimal('1.1'),
    end_date: null,
    ex_date_offset_days: 8,
    first_number: 1,
    first_payment_date: new Date('2025-01-15T00:00:00Z'),
    frequency_interval: 1,
    frequency_unit: 'MONTH',
    id: 'series-1',
    last_generated_number: 23,
    type: 'YIELD',
  },
};

beforeEach(() => {
  jest.resetAllMocks();
  spies.assetFindUnique.mockResolvedValue({ asset_class: 'BR_REIT' });
  spies.seriesFindMany.mockResolvedValue([mocks.series]);
  spies.incomeFindMany.mockResolvedValue([]);
  spies.operationFindMany.mockResolvedValue([mocks.buy]);
});
