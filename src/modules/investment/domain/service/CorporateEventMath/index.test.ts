import { InvestmentAssetClass } from '@investment/domain/enum';
import {
  applyBonus,
  applySplit,
  fractionUnitPrice,
  unitStepOf,
} from '@investment/domain/service/CorporateEventMath';
import { Decimal8 } from '@shared/infra/decimal';

function d(value: string) {
  return Decimal8.parse(value);
}

describe('CorporateEventMath', () => {
  describe('unitStepOf', () => {
    it('holds whole units for B3 classes and decimals for the others', () => {
      expect(unitStepOf(InvestmentAssetClass.BR_STOCK)).toBe('WHOLE');
      expect(unitStepOf(InvestmentAssetClass.BR_REIT)).toBe('WHOLE');
      expect(unitStepOf(InvestmentAssetClass.FOREIGN_STOCK)).toBe('DECIMAL');
      expect(unitStepOf(InvestmentAssetClass.PRIVATE)).toBe('DECIMAL');
    });
  });

  describe('applySplit', () => {
    it('splits 1:4 keeping the cost and the decimals of a foreign stock', () => {
      const step = applySplit({
        cost: 230500,
        quantity: d('12.5'),
        ratioFrom: d('1'),
        ratioTo: d('4'),
        step: 'DECIMAL',
      });

      expect(step.quantityAfter.toString()).toBe('50');
      expect(step.costAfter).toBe(230500);
      expect(step.fractionQuantity.isZero()).toBe(true);
      expect(step.fractionCost).toBe(0);
    });

    it('reverse splits 10:1 leaving a fraction that takes its share of the cost', () => {
      const step = applySplit({
        cost: 319100,
        quantity: d('3155'),
        ratioFrom: d('10'),
        ratioTo: d('1'),
        step: 'WHOLE',
      });

      expect(step.quantityAfter.toString()).toBe('315');
      expect(step.fractionQuantity.toString()).toBe('0.5');
      expect(step.fractionCost).toBe(506);
      expect(step.costAfter).toBe(318594);
    });

    it('turns the whole position into a fraction when no unit is left', () => {
      const step = applySplit({
        cost: 10000,
        quantity: d('50'),
        ratioFrom: d('100'),
        ratioTo: d('1'),
        step: 'WHOLE',
      });

      expect(step.quantityAfter.isZero()).toBe(true);
      expect(step.fractionQuantity.toString()).toBe('0.5');
      expect(step.fractionCost).toBe(10000);
      expect(step.costAfter).toBe(0);
    });
  });

  describe('applyBonus', () => {
    it('adds the cost of the new shares and takes the fraction out', () => {
      const step = applyBonus({
        cost: 318594,
        percent: d('10'),
        quantity: d('315'),
        step: 'WHOLE',
        unitCost: d('4.5'),
      });

      expect(step.quantityAfter.toString()).toBe('346');
      expect(step.fractionQuantity.toString()).toBe('0.5');
      expect(step.fractionCost).toBe(225);
      expect(step.costAfter).toBe(332544);
    });

    it('keeps the cost without a unit cost', () => {
      const step = applyBonus({
        cost: 318594,
        percent: d('10'),
        quantity: d('315'),
        step: 'WHOLE',
        unitCost: null,
      });

      expect(step.quantityAfter.toString()).toBe('346');
      expect(step.costAfter).toBe(318594);
      expect(step.fractionCost).toBe(0);
    });
  });

  describe('fractionUnitPrice', () => {
    it('divides the auction amount by the fraction for display (8 places)', () => {
      expect(fractionUnitPrice(520, d('0.5')).toString()).toBe('10.4');
      expect(fractionUnitPrice(100, d('0.3')).toFixed8()).toBe('3.33333333');
    });
  });
});
