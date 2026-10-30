import { AdjustAccountBalanceApiSchema } from './account.dto';
import {
  CreateEarlyPaymentApiSchema,
  CreateRefundApiSchema,
  UpdateEarlyPaymentApiSchema,
  UpdateRefundApiSchema,
} from './card-credit.dto';
import { PrepayInstallmentPlanApiSchema } from './installment-plan.dto';
import { PayInvoiceApiSchema } from './invoice.dto';

// Spec 059 FR 2: system rows never carry notes, so their strict schemas refuse the field.
describe('system-row bodies', () => {
  it.each([
    ['balance adjustment', AdjustAccountBalanceApiSchema],
    ['invoice payment', PayInvoiceApiSchema],
    ['card refund', CreateRefundApiSchema],
    ['card refund update', UpdateRefundApiSchema],
    ['early payment', CreateEarlyPaymentApiSchema],
    ['early payment update', UpdateEarlyPaymentApiSchema],
    ['installment prepayment', PrepayInstallmentPlanApiSchema],
  ])('SHOULD reject notes on a %s', (_name, schema) => {
    const result = schema.safeParse({ notes: 'x' });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (issue) => issue.code === 'unrecognized_keys' && issue.keys.includes('notes'),
      ),
    ).toBe(true);
  });
});
