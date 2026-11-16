import { computeConversion } from '@investment/domain/service/ConversionMath';
import { Decimal8 } from '@shared/infra/decimal';

function d(value: string): Decimal8 {
  return Decimal8.parse(value);
}

describe('computeConversion', () => {
  it('SHOULD split 103 quotas at 1 for 7.4 into 762 quotas AND a fraction of 0.2 (spec 112 example)', () => {
    const result = computeConversion({
      costOut: 808550,
      quantityOut: d('103'),
      ratioFrom: d('1'),
      ratioTo: d('7.4'),
      step: 'WHOLE',
    });

    expect(result.raw.toString()).toBe('762.2');
    expect(result.quantityIn.toString()).toBe('762');
    expect(result.fractionQuantity.toString()).toBe('0.2');
    expect(result.costIn).toBe(808550);
    expect(result.fractionCost).toBe(212);
    expect(result.cashCost).toBe(0);
    expect(result.realizedOut).toBe(0);
  });

  it('SHOULD keep every decimal place with the DECIMAL step', () => {
    const result = computeConversion({
      costOut: 1000,
      quantityOut: d('3'),
      ratioFrom: d('2'),
      ratioTo: d('1'),
      step: 'DECIMAL',
    });

    expect(result.quantityIn.toString()).toBe('1.5');
    expect(result.fractionQuantity.isZero()).toBe(true);
    expect(result.fractionCost).toBe(0);
  });

  it('SHOULD send the whole raw quantity to the fraction when no whole quota comes in', () => {
    const result = computeConversion({
      costOut: 5000,
      quantityOut: d('1'),
      ratioFrom: d('10'),
      ratioTo: d('3'),
      step: 'WHOLE',
    });

    expect(result.quantityIn.isZero()).toBe(true);
    expect(result.fractionQuantity.toString()).toBe('0.3');
    expect(result.fractionCost).toBe(5000);
  });

  it('SHOULD take the cash share out of the cost AND book the realized result on the origin', () => {
    const result = computeConversion({
      cash: { amount: 1500, referenceUnitValue: d('10.4') },
      costOut: 808550,
      quantityOut: d('103'),
      ratioFrom: d('1'),
      ratioTo: d('7.4'),
      step: 'WHOLE',
    });

    // quotas value = 762.2 × 10.40 = R$ 7.926,88 (792688 cents): cash cost = 808550 × 1500 / 794188
    expect(result.cashCost).toBe(1527);
    expect(result.costIn).toBe(808550 - 1527);
    expect(result.realizedOut).toBe(1500 - 1527);
    expect(result.cashCost).toBeLessThanOrEqual(808550);
  });
});
