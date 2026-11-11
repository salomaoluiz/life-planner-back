import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { bpsToRate, defaultIncomeType, estimateIncome, suggestNet, withholdingBps } from './index';

describe('withholdingBps', () => {
  it('SHOULD be 15% for JCP on any class', () => {
    expect(withholdingBps(InvestmentIncomeType.JCP, InvestmentAssetClass.BR_STOCK)).toBe(1500);
    expect(withholdingBps(InvestmentIncomeType.JCP, InvestmentAssetClass.FOREIGN_STOCK)).toBe(1500);
  });

  it('SHOULD be 30% for a DIVIDEND of a foreign stock only', () => {
    expect(withholdingBps(InvestmentIncomeType.DIVIDEND, InvestmentAssetClass.FOREIGN_STOCK)).toBe(
      3000,
    );
    expect(withholdingBps(InvestmentIncomeType.DIVIDEND, InvestmentAssetClass.BR_STOCK)).toBe(0);
  });

  it('SHOULD be 0 for everything else', () => {
    expect(withholdingBps(InvestmentIncomeType.YIELD, InvestmentAssetClass.BR_REIT)).toBe(0);
    expect(withholdingBps(InvestmentIncomeType.INTEREST, InvestmentAssetClass.FIXED_INCOME)).toBe(
      0,
    );
    expect(withholdingBps(InvestmentIncomeType.OTHER, InvestmentAssetClass.FOREIGN_STOCK)).toBe(0);
  });
});

describe('estimateIncome', () => {
  it('SHOULD estimate the gross and the withheld tax of a JCP', () => {
    expect(estimateIncome(7140, 1500)).toEqual({ gross: 8400, withheld: 1260 });
  });

  it('SHOULD return the net as gross WHEN the rate is 0', () => {
    expect(estimateIncome(14100, 0)).toEqual({ gross: 14100, withheld: 0 });
  });
});

describe('suggestNet', () => {
  it('SHOULD multiply quantity by the gross per unit and take the rate off', () => {
    expect(suggestNet(Decimal8.parse('300'), Decimal8.parse('0.47'), 0)).toBe(14100);
    expect(suggestNet(Decimal8.parse('300'), Decimal8.parse('0.28'), 1500)).toBe(7140);
  });
});

describe('defaultIncomeType', () => {
  it('SHOULD follow the asset class', () => {
    expect(defaultIncomeType(InvestmentAssetClass.BR_REIT)).toBe(InvestmentIncomeType.YIELD);
    expect(defaultIncomeType(InvestmentAssetClass.FIXED_INCOME)).toBe(
      InvestmentIncomeType.INTEREST,
    );
    expect(defaultIncomeType(InvestmentAssetClass.BR_STOCK)).toBe(InvestmentIncomeType.DIVIDEND);
    expect(defaultIncomeType(InvestmentAssetClass.PRIVATE)).toBe(InvestmentIncomeType.DIVIDEND);
  });
});

describe('bpsToRate', () => {
  it('SHOULD print the rate as a decimal string', () => {
    expect(bpsToRate(1500)).toBe('0.15');
    expect(bpsToRate(3000)).toBe('0.3');
    expect(bpsToRate(0)).toBe('0');
  });
});
