import { iofRate, irRate, lotTaxes } from '@investment/domain/service/FixedIncomeTaxes';

describe('FixedIncomeTaxes', () => {
  it.each([
    [0, 1],
    [1, 0.96],
    [15, 0.5],
    [29, 0.03],
    [30, 0],
    [400, 0],
  ])('iofRate(%i days) = %f', (days, rate) => {
    expect(iofRate(days)).toBe(rate);
  });

  it.each([
    [0, 0.225],
    [180, 0.225],
    [181, 0.2],
    [360, 0.2],
    [361, 0.175],
    [720, 0.175],
    [721, 0.15],
  ])('irRate(%i days) = %f', (days, rate) => {
    expect(irRate(days)).toBe(rate);
  });

  it('computes IOF on the yield and IR on yield minus IOF', () => {
    expect(
      lotTaxes({ days: 15, gross: 1_010_000, principal: 1_000_000, taxExempt: false }),
    ).toEqual({
      iof: 5_000,
      ir: 1_125,
      net: 1_003_875,
      yield: 10_000,
    });
  });

  it('keeps IOF but no IR for a tax exempt lot', () => {
    expect(lotTaxes({ days: 15, gross: 1_010_000, principal: 1_000_000, taxExempt: true })).toEqual(
      {
        iof: 5_000,
        ir: 0,
        net: 1_005_000,
        yield: 10_000,
      },
    );
  });

  it('has no taxes without yield', () => {
    expect(lotTaxes({ days: 0, gross: 1_000_000, principal: 1_000_000, taxExempt: false })).toEqual(
      {
        iof: 0,
        ir: 0,
        net: 1_000_000,
        yield: 0,
      },
    );
  });
});
