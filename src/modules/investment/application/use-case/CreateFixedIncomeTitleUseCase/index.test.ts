import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { emptyContext } from '@investment/application/service/QuoteContext';
import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  contribution: {
    accountId: 'acc-1',
    amount: 1_000_000,
    date: '2026-01-02',
    generateTransaction: true,
  },
  name: 'CDB Example 2030',
  owner: OwnerType.USER,
  ownerId: 'user-1',
  rate: { cdiPercent: '110', indexRate: '14.90', mode: 'CDI_PERCENT' as never },
  terms: {
    liquidity: 'DAILY' as never,
    maturityDate: '2030-01-02',
    product: 'CDB' as never,
    taxExempt: false,
  },
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T15:00:00Z'));
  spies.findAccountForOperation.mockResolvedValue({
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  });
  spies.createFixedIncomeTitle.mockResolvedValue({ assetId: 'asset-fi', operationId: 'lot-1' });
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  quoteSpies.load.mockResolvedValue({
    ...emptyContext(),
    fixedIncome: new Map([['asset-fi', fixedIncomeDataFixture()]]),
  });
});

afterEach(() => jest.useRealTimers());

it('SHOULD create the asset, terms, first rate AND contribution in one call', async () => {
  const detail = await setup.execute(input);

  expect(spies.createFixedIncomeTitle).toHaveBeenCalledWith(
    expect.objectContaining({
      asset: expect.objectContaining({ assetClass: 'FIXED_INCOME', currency: 'BRL', ticker: null }),
      contribution: expect.objectContaining({
        accountId: 'acc-1',
        gross: 1_000_000,
        quantity: expect.objectContaining({ scaled: 1_000_000_000_000n }),
        total: 1_000_000,
        type: 'BUY',
        unitPrice: expect.objectContaining({ scaled: 100_000_000n }),
      }),
      rate: expect.objectContaining({ mode: 'CDI_PERCENT', startDate: '2026-01-02' }),
      terms: expect.objectContaining({ liquidityDate: null, maturityDate: '2030-01-02' }),
    }),
  );
  expect(Number(spies.createFixedIncomeTitle.mock.calls[0][0].rate.effectiveRate)).toBeCloseTo(
    16.51,
    1,
  );
  expect(detail.fixedIncome?.product).toBe('CDB');
});

it('SHOULD refuse an owner the caller cannot reach', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(ForbiddenException);
});

it('SHOULD refuse an archived family', async () => {
  await expect(
    setup.execute({
      ...input,
      accessibleOwners: [{ archived: true, owner: OwnerType.USER, ownerId: 'user-1' }],
    }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse a maturity that is not after the first contribution', async () => {
  await expect(
    setup.execute({ ...input, terms: { ...input.terms, maturityDate: '2026-01-02' } }),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(spies.createFixedIncomeTitle).not.toHaveBeenCalled();
});

it('SHOULD refuse an account that is not in BRL', async () => {
  spies.findAccountForOperation.mockResolvedValue({
    archived: false,
    currency: 'USD',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  });

  await expect(setup.execute(input)).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse a grace period without its date AND a future contribution date', async () => {
  await expect(
    setup.execute({ ...input, terms: { ...input.terms, liquidity: 'GRACE_PERIOD' as never } }),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.execute({ ...input, contribution: { ...input.contribution, date: '2026-11-11' } }),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD create without a finance entry WHEN generateTransaction is off', async () => {
  await setup.execute({
    ...input,
    contribution: { amount: 1_000_000, date: '2026-01-02', generateTransaction: false },
  });

  expect(spies.findAccountForOperation).not.toHaveBeenCalled();
  expect(spies.createFixedIncomeTitle.mock.calls[0][0].contribution.accountId).toBeNull();
});
