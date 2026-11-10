import { FeeSchema } from '@investment/application/dto/InvestmentCommon';
import { InvestmentFeeKind } from '@investment/domain/enum';

describe('FeeSchema', () => {
  it.each([InvestmentFeeKind.INCOME_TAX, InvestmentFeeKind.IOF])(
    'SHOULD refuse the system-only kind %s (spec 105 FR 20)',
    (kind) => {
      expect(FeeSchema.safeParse({ amount: 100, kind }).success).toBe(false);
    },
  );

  it('SHOULD accept a brokerage fee', () => {
    expect(FeeSchema.parse({ amount: 100, kind: InvestmentFeeKind.BROKERAGE })).toEqual({
      amount: 100,
      description: null,
      kind: 'BROKERAGE',
    });
  });
});
