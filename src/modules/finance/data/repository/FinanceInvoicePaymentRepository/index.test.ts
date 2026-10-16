import { Test } from '@nestjs/testing';

import { FinanceInvoicePaymentRepository } from './index';

const raw = {
  account: { name: 'Checking' },
  account_id: 'acc-1',
  amount: 100,
  created_at: new Date('2026-11-05T10:00:00.000Z'),
  credit_card_id: 'card-1',
  id: 'p-1',
  invoice_month: '2026-10',
  method: 'ACCOUNT',
  owner: 'USER',
  owner_id: 'owner-1',
  paid_on: new Date('2026-11-05T00:00:00.000Z'),
  transaction_id: 'tx-1',
  updated_at: new Date('2026-11-05T10:00:00.000Z'),
};
const datasource = {
  exists: jest.fn().mockResolvedValue(true),
  findByCardAndMonth: jest.fn().mockResolvedValue(raw),
  findByCardIds: jest.fn().mockResolvedValue([raw]),
  pay: jest.fn().mockResolvedValue(raw),
  undo: jest.fn().mockResolvedValue(undefined),
};
let setup: FinanceInvoicePaymentRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    providers: [
      FinanceInvoicePaymentRepository,
      { provide: 'IFinanceInvoicePaymentDatasource', useValue: datasource },
    ],
  }).compile();

  setup = module.get(FinanceInvoicePaymentRepository);
});

describe('FinanceInvoicePaymentRepository', () => {
  it('SHOULD map reads and answer undefined WHEN not found', async () => {
    expect((await setup.findByCardAndMonth('card-1', '2026-10'))?.paidOn).toBe('2026-11-05');
    datasource.findByCardAndMonth.mockResolvedValueOnce(null);
    expect(await setup.findByCardAndMonth('card-1', '2026-11')).toBeUndefined();
    expect(await setup.findByCardIds(['card-1'])).toHaveLength(1);
    expect(await setup.existsByOwner({ owner: 'USER' as never, ownerId: 'o' })).toBe(true);
  });

  it('SHOULD translate the pay params to the datasource and back', async () => {
    const result = await setup.payInvoice({
      accountId: 'acc-1',
      accountOwner: { owner: 'USER' as never, ownerId: 'owner-1' },
      amount: 100,
      categoryId: 'cat',
      creditCardId: 'card-1',
      description: 'Invoice payment',
      invoiceMonth: '2026-10',
      method: 'ACCOUNT' as never,
      owner: 'USER' as never,
      ownerId: 'owner-1',
      paidOn: '2026-11-05',
    });

    expect(result.id).toBe('p-1');
    expect(datasource.pay).toHaveBeenCalledWith(
      expect.objectContaining({
        account_owner_id: 'owner-1',
        paid_on: new Date('2026-11-05T00:00:00.000Z'),
      }),
    );
  });

  it('SHOULD undo through the datasource', async () => {
    await setup.undoPayment('card-1', '2026-10');

    expect(datasource.undo).toHaveBeenCalledWith('card-1', '2026-10');
  });
});
