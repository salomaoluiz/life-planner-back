import { ActivityEntityType, ActivityModule } from '@activity/domain/enum';
import { Database } from '@shared/infra/db/Database';

import { ActivitySnapshotDatasource } from './index';

const date = new Date('2022-04-15T00:00:00.000Z');
const owner = { owner: 'FAMILY', owner_id: 'f-1' };
const asset = { currency: 'BRL', name: 'Petrobras', ticker: 'PETR4', ...owner };
const account = { name: 'Conta corrente', ...owner };
function build(rows: Record<string, unknown>) {
  const client = {
    family: find({ name: 'Família Silva' }),
    investmentFixedIncomeAdjustment: find({ asset_id: 'asset-2' }),
    investmentFixedIncomeRate: find({ asset_id: 'asset-1' }),
    user: find({ name: 'Ana' }),
    ...Object.fromEntries(Object.entries(rows).map(([model, row]) => [model, find(row)])),
  };

  return new ActivitySnapshotDatasource({ client } as unknown as Database);
}
function find(row: unknown) {
  return {
    findFirst: jest.fn().mockResolvedValue(row),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(row),
  };
}

const cases: [ActivityEntityType, string, unknown][] = [
  [
    ActivityEntityType.TRANSACTION,
    'financialTransaction',
    {
      account: { name: 'Conta corrente' },
      category: { name: 'Mercado' },
      credit_card: null,
      currency: 'BRL',
      date,
      description: 'Mercado',
      id: 'e-1',
      tags: [{ tag: { name: 'b' } }, { tag: { name: 'a' } }],
      type: 'EXPENSE',
      value: 120000,
      ...owner,
    },
  ],
  [
    ActivityEntityType.TRANSFER,
    'financialTransfer',
    {
      amount_out: 5000,
      currency_out: 'BRL',
      date_in: date,
      date_out: date,
      description: 'Poupar',
      from_account: account,
      id: 'e-1',
      to_account: { name: 'Poupança', owner: 'FAMILY', owner_id: 'f-2' },
    },
  ],
  [
    ActivityEntityType.SPLIT,
    'financialSplit',
    {
      account: { name: 'Conta' },
      credit_card: null,
      currency: 'BRL',
      date,
      description: 'Racha',
      id: 'e-1',
      transactions: [{ description: 'a', type: 'EXPENSE', value: 100 }],
      ...owner,
    },
  ],
  [
    ActivityEntityType.RECURRENCE,
    'financialRecurrence',
    {
      account: { name: 'Conta' },
      category: { name: 'Casa' },
      credit_card: null,
      currency: 'BRL',
      description: 'Aluguel',
      id: 'e-1',
      skipped_numbers: [],
      start_date: date,
      to_account: null,
      type: 'EXPENSE',
      value: 100,
      ...owner,
    },
  ],
  [
    ActivityEntityType.INSTALLMENT_PLAN,
    'financialInstallmentPlan',
    {
      category: { name: 'Casa' },
      credit_card: { title: 'Cartão Roxo' },
      currency: 'BRL',
      date,
      description: 'Sofá',
      id: 'e-1',
      installment_count: 6,
      total_value: 6000,
      ...owner,
    },
  ],
  [
    ActivityEntityType.INSTALLMENT_PREPAYMENT,
    'financialInstallmentPrepayment',
    {
      date,
      discount_transaction: null,
      id: 'e-1',
      installment_plan: {
        credit_card: { title: 'Cartão Roxo' },
        currency: 'BRL',
        description: 'Sofá',
      },
      target_invoice_month: '2026-12',
      ...owner,
    },
  ],
  [
    ActivityEntityType.INVOICE_PAYMENT,
    'financialInvoicePayment',
    {
      account: { name: 'Conta' },
      amount: 900,
      credit_card: { currency: 'BRL', title: 'Cartão Roxo' },
      id: 'e-1',
      invoice_month: '2026-11',
      method: 'ACCOUNT',
      paid_on: date,
      ...owner,
    },
  ],
  [
    ActivityEntityType.ACCOUNT,
    'financialAccount',
    {
      currency: 'BRL',
      favorites: [],
      icon: 'bank',
      id: 'e-1',
      initial_balance: 0,
      name: 'Conta',
      status: 'ACTIVE',
      type: 'CHECKING',
      ...owner,
    },
  ],
  [
    ActivityEntityType.CREDIT_CARD,
    'financialCreditCard',
    {
      brand: 'VISA',
      closing_day: 1,
      color: 'red',
      currency: 'BRL',
      due_day: 8,
      id: 'e-1',
      last_digits: null,
      limit: 100,
      payment_account: null,
      status: 'ACTIVE',
      title: 'Cartão Roxo',
      ...owner,
    },
  ],
  [
    ActivityEntityType.CATEGORY,
    'financialCategory',
    {
      exclude_from_totals: false,
      icon: 'cart',
      icon_color: 'red',
      id: 'e-1',
      name: 'Mercado',
      parent: null,
      status: 'ACTIVE',
      type: 'EXPENSE',
      ...owner,
    },
  ],
  [
    ActivityEntityType.TAG,
    'financialTag',
    { all_scopes: false, id: 'e-1', name: 'Viagem', ...owner },
  ],
  [
    ActivityEntityType.STOCK_PURCHASE_POSTING,
    'stockPurchase',
    {
      currency: 'BRL',
      id: 'e-1',
      market: { name: 'Mercado Exemplo' },
      purchase_date: date,
      receipt_total_cents: 5000,
      ...owner,
    },
  ],
  [
    ActivityEntityType.ASSET,
    'investmentAsset',
    { asset_class: 'STOCK', id: 'e-1', status: 'ACTIVE', ...asset },
  ],
  [
    ActivityEntityType.OPERATION,
    'investmentOperation',
    {
      account: { name: 'Conta' },
      asset,
      date,
      fees_total: 0,
      generate_transaction: true,
      id: 'e-1',
      quantity: { toString: () => '10' },
      total: 3000,
      transaction_id: 't-1',
      type: 'BUY',
      unit_price: { toString: () => '30' },
    },
  ],
  [
    ActivityEntityType.VALUATION,
    'investmentValuation',
    { asset, date, id: 'e-1', unit_price: { toString: () => '12.5' } },
  ],
  [
    ActivityEntityType.FIXED_INCOME_TERMS,
    'investmentFixedIncomeTerms',
    {
      asset,
      asset_id: 'e-1',
      liquidity: 'DAILY',
      liquidity_date: null,
      maturity_date: date,
      product: 'CDB',
      tax_exempt: false,
    },
  ],
  [
    ActivityEntityType.INCOME,
    'investmentIncome',
    {
      asset,
      currency: 'BRL',
      ex_date: null,
      id: 'e-1',
      net_amount: 800,
      notes: null,
      payment_date: date,
      quantity: null,
      received: false,
      transaction_id: null,
      type: 'DIVIDEND',
    },
  ],
  [
    ActivityEntityType.INCOME_SERIES,
    'investmentIncomeSeries',
    {
      amount_per_unit: { toString: () => '0.1' },
      asset,
      currency: 'BRL',
      end_date: null,
      first_payment_date: date,
      frequency_interval: 1,
      frequency_unit: 'MONTH',
      id: 'e-1',
      notes: null,
      type: 'DIVIDEND',
      with_finance: true,
    },
  ],
  [
    ActivityEntityType.CONVERSION,
    'investmentConversion',
    {
      cash_amount: null,
      date,
      from: asset,
      id: 'e-1',
      ratio_from: { toString: () => '1' },
      ratio_to: { toString: () => '2' },
      to: { ...asset, name: 'Outra', owner_id: 'f-2', ticker: null },
    },
  ],
];

describe('composite ids and special readers', () => {
  it('SHOULD find an invoice payment by card and month, AND a prepayment by plan', async () => {
    const payment = build({
      financialInvoicePayment: {
        account: { name: 'Conta' },
        amount: 900,
        credit_card: { currency: 'BRL', title: 'Cartão Roxo' },
        id: 'p-1',
        invoice_month: '2026-11',
        method: 'ACCOUNT',
        paid_on: date,
        ...owner,
      },
    });
    const prepayment = build({
      financialInstallmentPrepayment: {
        date,
        discount_transaction: null,
        id: 'pp-1',
        installment_plan: {
          credit_card: { title: 'Cartão Roxo' },
          currency: 'BRL',
          description: 'Sofá',
        },
        target_invoice_month: '2026-12',
        ...owner,
      },
    });

    await expect(
      payment.read(ActivityEntityType.INVOICE_PAYMENT, 'card-1:2026-11'),
    ).resolves.toMatchObject({
      entityId: 'p-1',
    });
    await expect(
      prepayment.read(ActivityEntityType.INSTALLMENT_PREPAYMENT, 'plan:plan-1'),
    ).resolves.toMatchObject({
      entityId: 'pp-1',
    });
  });

  it('SHOULD describe a balance adjustment by the account AND a CSV import by its owner', async () => {
    const adjust = build({
      financialAccount: {
        currency: 'BRL',
        id: 'a-1',
        ledger_balance: 1500,
        name: 'Conta',
        ...owner,
      },
    });

    await expect(adjust.read(ActivityEntityType.BALANCE_ADJUSTMENT, 'a-1')).resolves.toMatchObject({
      amountCents: 1500,
      label: 'Conta',
    });
    await expect(
      build({}).read(ActivityEntityType.TRANSACTION_IMPORT, 'FAMILY|f-1'),
    ).resolves.toMatchObject({
      entityId: '',
      owners: [expect.objectContaining({ ownerId: 'f-1', ownerName: 'Família Silva' })],
    });
  });
});

describe('fixed income and valuation keys', () => {
  const terms = {
    asset,
    asset_id: 'asset-1',
    liquidity: 'DAILY',
    liquidity_date: null,
    maturity_date: date,
    product: 'CDB',
    tax_exempt: false,
  };

  it('SHOULD find the title of a rate AND of an adjustment by their ids', async () => {
    const reader = build({ investmentFixedIncomeTerms: terms });

    await expect(
      reader.read(ActivityEntityType.FIXED_INCOME_TERMS, 'rate:r-1'),
    ).resolves.toMatchObject({
      entityId: 'asset-1',
    });
    await expect(
      reader.read(ActivityEntityType.FIXED_INCOME_TERMS, 'adjustment:a-1'),
    ).resolves.toMatchObject({
      entityId: 'asset-1',
    });
  });

  it('SHOULD find a valuation by asset and date AND an income with its series', async () => {
    const valuation = build({
      investmentValuation: { asset, date, id: 'v-1', unit_price: { toString: () => '12.5' } },
    });
    const income = build({
      investmentIncome: {
        asset,
        asset_id: 'asset-1',
        currency: 'BRL',
        id: 'i-1',
        net_amount: 800,
        payment_date: date,
        series_id: 's-1',
        type: 'DIVIDEND',
      },
    });

    await expect(
      valuation.read(ActivityEntityType.VALUATION, 'asset-1:2026-10-01'),
    ).resolves.toMatchObject({
      entityId: 'v-1',
    });
    await expect(income.read(ActivityEntityType.INCOME, 'i-1')).resolves.toMatchObject({
      extra: { assetId: 'asset-1' },
      refs: { seriesId: 's-1' },
    });
  });
});

describe('ActivitySnapshotDatasource', () => {
  it.each(cases)('SHOULD read a %s snapshot with its owner AND label', async (type, model, row) => {
    const snapshot = await build({ [model]: row }).read(type, 'e-1');

    expect(snapshot).toMatchObject({ entityType: type });
    expect(snapshot?.label).toEqual(expect.any(String));
    expect(snapshot?.owners.length).toBeGreaterThan(0);
    expect(snapshot?.owners[0].ownerName).toBe('Família Silva');
  });

  it.each(cases)('SHOULD return null for a %s that is gone', async (type, model) => {
    await expect(build({ [model]: null }).read(type, 'e-1')).resolves.toBeNull();
  });

  it('SHOULD sign an expense negative AND resolve the tag names sorted', async () => {
    const snapshot = await build({ financialTransaction: cases[0][2] }).read(
      ActivityEntityType.TRANSACTION,
      'e-1',
    );

    expect(snapshot).toMatchObject({
      amountCents: -120000,
      bookingDate: '2022-04-15',
      fields: { category: 'Mercado', tags: ['a', 'b'] },
      modules: [ActivityModule.FINANCE],
      sources: ['Conta corrente'],
    });
  });

  it('SHOULD list both owners WHEN a transfer or a conversion crosses owners', async () => {
    const transfer = await build({ financialTransfer: cases[1][2] }).read(
      ActivityEntityType.TRANSFER,
      'e-1',
    );
    const conversion = await build({ investmentConversion: cases[18][2] }).read(
      ActivityEntityType.CONVERSION,
      'e-1',
    );

    expect(transfer?.owners.map((entry) => entry.ownerId)).toEqual(['f-1', 'f-2']);
    expect(conversion?.owners.map((entry) => entry.ownerId)).toEqual(['f-1', 'f-2']);
  });

  it('SHOULD put an operation with a finance row in both modules', async () => {
    const snapshot = await build({ investmentOperation: cases[13][2] }).read(
      ActivityEntityType.OPERATION,
      'e-1',
    );

    expect(snapshot?.modules).toEqual([ActivityModule.INVESTMENT, ActivityModule.FINANCE]);
    expect(snapshot?.amountCents).toBe(-3000);
  });

  it('SHOULD skip a system category (no owner) AND throw for an entity without a reader', async () => {
    const system = { ...(cases[9][2] as object), owner: null, owner_id: null };

    await expect(
      build({ financialCategory: system }).read(ActivityEntityType.CATEGORY, 'e-1'),
    ).resolves.toBeNull();
    await expect(build({}).read(ActivityEntityType.CORPORATE_EVENT, 'x')).rejects.toThrow(
      'No activity snapshot reader',
    );
  });

  it('SHOULD name a USER owner with the user name', async () => {
    const row = { ...(cases[11][2] as object), owner: 'USER', owner_id: 'u-1' };
    const snapshot = await build({ financialTag: row }).read(ActivityEntityType.TAG, 'e-1');

    expect(snapshot?.owners[0].ownerName).toBe('Ana');
  });
});
