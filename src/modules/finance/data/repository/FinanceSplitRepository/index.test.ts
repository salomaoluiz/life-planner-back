import { Test } from '@nestjs/testing';

import { mocks as transactionMocks } from '@finance/data/datasource/mapper/FinanceTransactionMapper/index.mocks';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { FinanceSplitRepository } from './index';

const record = {
  account_id: 'acc-1',
  created_at: new Date('2026-11-15T10:00:00.000Z'),
  created_by: 'user-1',
  credit_card_id: null,
  currency: 'BRL',
  date: new Date('2026-11-15T00:00:00.000Z'),
  description: 'Mercado',
  id: 'split-1',
  invoice_month: null,
  notes: null,
  occurrence_number: null,
  owner: 'USER',
  owner_id: 'user-1',
  paid: true,
  recurrence_id: null,
  transactions: [{ ...transactionMocks.raw, id: 'p1', split_id: 'split-1', value: 100 }],
  updated_at: new Date('2026-11-15T10:00:00.000Z'),
};
const write = {
  accountId: 'acc-1',
  createdBy: 'user-1',
  creditCardId: null,
  currency: 'BRL' as const,
  date: '2026-11-15',
  description: 'Mercado',
  invoiceMonth: null,
  notes: null,
  owner: OwnerType.USER,
  ownerId: 'user-1',
  paid: true,
  parts: [
    {
      categoryId: 'cat-1',
      description: null,
      tags: ['casa'],
      type: TransactionType.EXPENSE,
      value: 1,
    },
  ],
  sourceTransactionId: 'row-1',
};

const splitDatasource = {
  create: jest.fn(),
  createMany: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findSummaries: jest.fn(),
  setPaid: jest.fn(),
  update: jest.fn(),
};
const transactionDatasource = { findById: jest.fn() };

let setup: FinanceSplitRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  splitDatasource.create.mockResolvedValue(record);
  splitDatasource.findById.mockResolvedValue(record);
  splitDatasource.findByIds.mockResolvedValue([record]);
  splitDatasource.setPaid.mockResolvedValue(record);
  transactionDatasource.findById.mockResolvedValue(transactionMocks.raw);

  const module = await Test.createTestingModule({
    providers: [
      FinanceSplitRepository,
      { provide: 'IFinanceSplitDatasource', useValue: splitDatasource },
      { provide: 'IFinanceTransactionDatasource', useValue: transactionDatasource },
    ],
  }).compile();

  setup = module.get(FinanceSplitRepository);
});

it('SHOULD translate the write to the datasource shape AND map the created split', async () => {
  const split = await setup.createSplit(write);

  expect(split.id).toBe('split-1');
  expect(splitDatasource.create).toHaveBeenCalledWith(
    expect.objectContaining({
      account_id: 'acc-1',
      date: new Date('2026-11-15T00:00:00.000Z'),
      occurrence_number: null,
      parts: [expect.objectContaining({ category_id: 'cat-1', tag_names: ['casa'] })],
      recurrence_id: null,
      source_transaction_id: 'row-1',
    }),
  );
});

it('SHOULD import, delete, read AND set paid through the datasource', async () => {
  splitDatasource.createMany.mockResolvedValue(2);

  expect(await setup.createSplits([write, write])).toBe(2);
  await setup.deleteSplit('split-1');
  expect(splitDatasource.delete).toHaveBeenCalledWith('split-1');
  expect((await setup.findSplitById('split-1'))?.id).toBe('split-1');
  expect(await setup.findSplitsByIds(['split-1'])).toHaveLength(1);
  expect((await setup.setSplitPaid('split-1', true)).id).toBe('split-1');
  splitDatasource.findById.mockResolvedValueOnce(null);
  expect(await setup.findSplitById('x')).toBeUndefined();
});

it('SHOULD summarize the headers with the net total of the amounts', async () => {
  splitDatasource.findSummaries.mockResolvedValue([
    {
      ...record,
      transactions: [
        { type: 'EXPENSE', value: 12000 },
        { type: 'EXPENSE', value: -440 },
      ],
    },
  ]);

  expect(await setup.findSplitSummaries(['split-1'])).toEqual([
    expect.objectContaining({ id: 'split-1', partCount: 2, total: 11560, type: 'EXPENSE' }),
  ]);
});

it('SHOULD answer the dissolved transaction OR the updated split', async () => {
  splitDatasource.update.mockResolvedValueOnce({ dissolved_id: 'p1' });

  expect((await setup.updateSplit('split-1', write)).dissolved?.id).toBe(transactionMocks.raw.id);

  splitDatasource.update.mockResolvedValueOnce({ split: record });

  expect((await setup.updateSplit('split-1', write)).split?.id).toBe('split-1');
  splitDatasource.update.mockResolvedValueOnce({ dissolved_id: 'gone' });
  transactionDatasource.findById.mockResolvedValueOnce(null);
  expect((await setup.updateSplit('split-1', write)).dissolved).toBeUndefined();
});
