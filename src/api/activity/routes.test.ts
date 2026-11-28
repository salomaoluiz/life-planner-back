import { AccountController } from '@api/finance/v1/account.controller';
import { CardCreditController } from '@api/finance/v1/card-credit.controller';
import { CategoryController } from '@api/finance/v1/category.controller';
import { CreditCardController } from '@api/finance/v1/credit-card.controller';
import { InstallmentPlanController } from '@api/finance/v1/installment-plan.controller';
import { InvoiceController } from '@api/finance/v1/invoice.controller';
import { RecurrenceController } from '@api/finance/v1/recurrence.controller';
import { SplitController } from '@api/finance/v1/split.controller';
import { TagController } from '@api/finance/v1/tag.controller';
import { TransactionCsvController } from '@api/finance/v1/transaction-csv.controller';
import { TransactionController } from '@api/finance/v1/transaction.controller';
import { TransferController } from '@api/finance/v1/transfer.controller';
import { ConversionController } from '@api/investment/v1/conversion.controller';
import { CorporateEventController } from '@api/investment/v1/corporate-event.controller';
import { FixedIncomeController } from '@api/investment/v1/fixed-income.controller';
import { IncomeSeriesController } from '@api/investment/v1/income-series.controller';
import { IncomeController } from '@api/investment/v1/income.controller';
import { InvestmentController } from '@api/investment/v1/investment.controller';
import { PurchaseController } from '@api/stock/v1/purchase.controller';

import { ACTIVITY_METADATA, ActivityDescriptor } from './ActivityRecorder';

type Controller = abstract new (...args: never[]) => unknown;

// Spec 127 FR 1: every user write route of Finance and Investments records an entry. This is the whole list: a new
// write route must be added here (and decorated), or be one of the documented automatic or read-only routes.
const RECORDED: [Controller, [string, string, string][]][] = [
  [
    AccountController,
    [
      ['adjustBalance', 'CREATE', 'BALANCE_ADJUSTMENT'],
      ['create', 'CREATE', 'ACCOUNT'],
      ['delete', 'DELETE', 'ACCOUNT'],
      ['update', 'UPDATE', 'ACCOUNT'],
    ],
  ],
  [
    CardCreditController,
    [
      ['createEarlyPayment', 'CREATE', 'CARD_EARLY_PAYMENT'],
      ['createRefund', 'CREATE', 'CARD_REFUND'],
      ['deleteEarlyPayment', 'DELETE', 'CARD_EARLY_PAYMENT'],
      ['deleteRefund', 'DELETE', 'CARD_REFUND'],
      ['updateEarlyPayment', 'UPDATE', 'CARD_EARLY_PAYMENT'],
      ['updateRefund', 'UPDATE', 'CARD_REFUND'],
    ],
  ],
  [
    CategoryController,
    [
      ['create', 'CREATE', 'CATEGORY'],
      ['delete', 'DELETE', 'CATEGORY'],
      ['update', 'UPDATE', 'CATEGORY'],
      ['updateAppearance', 'UPDATE', 'CATEGORY'],
    ],
  ],
  [
    CreditCardController,
    [
      ['create', 'CREATE', 'CREDIT_CARD'],
      ['delete', 'DELETE', 'CREDIT_CARD'],
      ['update', 'UPDATE', 'CREDIT_CARD'],
    ],
  ],
  [
    InstallmentPlanController,
    [
      ['create', 'CREATE', 'INSTALLMENT_PLAN'],
      ['delete', 'DELETE', 'INSTALLMENT_PLAN'],
      ['deletePrepayment', 'DELETE', 'INSTALLMENT_PREPAYMENT'],
      ['prepay', 'CREATE', 'INSTALLMENT_PREPAYMENT'],
      ['update', 'UPDATE', 'INSTALLMENT_PLAN'],
    ],
  ],
  [
    InvoiceController,
    [
      ['deletePayment', 'DELETE', 'INVOICE_PAYMENT'],
      ['pay', 'CREATE', 'INVOICE_PAYMENT'],
    ],
  ],
  [
    RecurrenceController,
    [
      ['create', 'CREATE', 'RECURRENCE'],
      ['delete', 'DELETE', 'RECURRENCE'],
      ['deleteOccurrence', 'UPDATE', 'RECURRENCE'],
      ['materializeOccurrence', 'CREATE', 'TRANSACTION'],
      ['split', 'UPDATE', 'RECURRENCE'],
      ['update', 'UPDATE', 'RECURRENCE'],
    ],
  ],
  [
    SplitController,
    [
      ['create', 'CREATE', 'SPLIT'],
      ['delete', 'DELETE', 'SPLIT'],
      ['update', 'UPDATE', 'SPLIT'],
    ],
  ],
  [
    TagController,
    [
      ['create', 'CREATE', 'TAG'],
      ['delete', 'DELETE', 'TAG'],
      ['update', 'UPDATE', 'TAG'],
    ],
  ],
  [TransactionCsvController, [['import', 'CREATE', 'TRANSACTION_IMPORT']]],
  [
    TransactionController,
    [
      ['confirm', 'UPDATE', 'TRANSACTION'],
      ['create', 'CREATE', 'TRANSACTION'],
      ['delete', 'DELETE', 'TRANSACTION'],
      ['update', 'UPDATE', 'TRANSACTION'],
    ],
  ],
  [
    TransferController,
    [
      ['create', 'CREATE', 'TRANSFER'],
      ['delete', 'DELETE', 'TRANSFER'],
      ['update', 'UPDATE', 'TRANSFER'],
    ],
  ],
  [
    ConversionController,
    [
      ['create', 'CREATE', 'CONVERSION'],
      ['delete', 'DELETE', 'CONVERSION'],
      ['update', 'UPDATE', 'CONVERSION'],
    ],
  ],
  [
    CorporateEventController,
    [
      ['approveSuggestion', 'CREATE', 'OPERATION'],
      ['createFractionSale', 'CREATE', 'OPERATION'],
    ],
  ],
  [
    FixedIncomeController,
    [
      ['createContribution', 'CREATE', 'OPERATION'],
      ['createRate', 'UPDATE', 'FIXED_INCOME_TERMS'],
      ['createRedemption', 'CREATE', 'OPERATION'],
      ['createTitle', 'CREATE', 'ASSET'],
      ['deleteAdjustment', 'UPDATE', 'FIXED_INCOME_TERMS'],
      ['deleteRate', 'UPDATE', 'FIXED_INCOME_TERMS'],
      ['updateRate', 'UPDATE', 'FIXED_INCOME_TERMS'],
      ['upsertAdjustment', 'UPDATE', 'FIXED_INCOME_TERMS'],
      ['upsertTerms', 'UPDATE', 'FIXED_INCOME_TERMS'],
    ],
  ],
  [
    IncomeSeriesController,
    [
      ['create', 'CREATE', 'INCOME_SERIES'],
      ['update', 'UPDATE', 'INCOME_SERIES'],
    ],
  ],
  [
    IncomeController,
    [
      ['approveSuggestion', 'CREATE', 'INCOME'],
      ['createIncome', 'CREATE', 'INCOME'],
      ['deleteIncome', 'DELETE', 'INCOME'],
      ['receiveIncome', 'UPDATE', 'INCOME'],
      ['updateIncome', 'UPDATE', 'INCOME'],
    ],
  ],
  [
    InvestmentController,
    [
      ['createAsset', 'CREATE', 'ASSET'],
      ['createOperation', 'CREATE', 'OPERATION'],
      ['deleteAsset', 'DELETE', 'ASSET'],
      ['deleteOperation', 'DELETE', 'OPERATION'],
      ['deleteValuation', 'DELETE', 'VALUATION'],
      ['updateAsset', 'UPDATE', 'ASSET'],
      ['updateOperation', 'UPDATE', 'OPERATION'],
      ['upsertValuation', 'UPDATE', 'VALUATION'],
    ],
  ],
  [PurchaseController, [['close', 'UPDATE', 'STOCK_PURCHASE_POSTING']]],
];

function decorated(controller: Controller): Record<string, ActivityDescriptor> {
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.fromEntries(
    Object.getOwnPropertyNames(prototype)
      .map((name) => [name, Reflect.getMetadata(ACTIVITY_METADATA, prototype[name] as object)])
      .filter(([, descriptor]) => descriptor !== undefined),
  );
}

describe('routes that record activity (spec 127 FR 1)', () => {
  it.each(RECORDED)('SHOULD decorate exactly the recorded routes of %p', (controller, routes) => {
    const found = decorated(controller);

    expect(Object.keys(found).sort()).toEqual(routes.map(([method]) => method).sort());
    routes.forEach(([method, action, entityType]) => {
      expect([found[method].action, found[method].entityType]).toEqual([action, entityType]);
    });
  });

  it('SHOULD NOT decorate the read, preview, simulate and refresh routes', () => {
    expect(Object.keys(decorated(InvestmentController))).not.toContain('refreshQuotes');
    expect(Object.keys(decorated(FixedIncomeController))).not.toEqual(
      expect.arrayContaining(['simulate', 'redemptionPreview']),
    );
    expect(Object.keys(decorated(IncomeSeriesController))).not.toContain('preview');
  });

  it('SHOULD record a stock purchase close as a finance create, skipped for a replay or no posting', () => {
    const { close } = decorated(PurchaseController);
    const context = { response: { splitId: 's-1', transactionId: null } } as never;

    expect(close.entryAction).toBe('CREATE');
    expect(close.skipWhen?.(context, { fields: { status: 'OPEN' } } as never)).toBe(false);
    expect(close.skipWhen?.(context, { fields: { status: 'CLOSED' } } as never)).toBe(true);
    expect(
      close.skipWhen?.({ response: { splitId: null, transactionId: null } } as never, null),
    ).toBe(true);
  });

  it('SHOULD skip the dry run of a CSV import', () => {
    const { import: csv } = decorated(TransactionCsvController);

    expect(csv.skipWhen?.({ body: { dryRun: true } } as never, null)).toBe(true);
    expect(csv.skipWhen?.({ body: { dryRun: false } } as never, null)).toBe(false);
  });
});
