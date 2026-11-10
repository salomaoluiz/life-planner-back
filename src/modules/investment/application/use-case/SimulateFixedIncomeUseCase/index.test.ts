import { UnprocessableEntityException } from '@nestjs/common';

import { setup } from './index.mocks';

const input = {
  amount: 1_000_000,
  date: '2026-01-02',
  maturityDate: '2028-01-03',
  rate: { cdiPercent: '110', indexRate: '14.90', mode: 'CDI_PERCENT' as never },
  taxExempt: false,
};

it('SHOULD return the effective rate AND the estimate at maturity', async () => {
  const result = await setup.execute(input);

  expect(Number(result.effectiveRate)).toBeCloseTo(16.51, 1);
  expect(result.atMaturity.gross).toBeGreaterThan(1_300_000);
  expect(result.atMaturity.iof).toBe(0);
  expect(result.atMaturity.ir).toBeGreaterThan(0);
  expect(result.atMaturity.net).toBe(result.atMaturity.gross - result.atMaturity.ir);
});

it('SHOULD have no IR for a tax exempt title', async () => {
  const result = await setup.execute({ ...input, taxExempt: true });

  expect(result.atMaturity.ir).toBe(0);
});

it('SHOULD refuse a maturity that is not after the date', async () => {
  await expect(setup.execute({ ...input, maturityDate: '2026-01-02' })).rejects.toThrow(
    UnprocessableEntityException,
  );
});
