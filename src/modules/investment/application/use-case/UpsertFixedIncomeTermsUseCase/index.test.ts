import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  assetFixture,
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const base = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  assetId: 'asset-fi',
  terms: {
    liquidity: 'DAILY' as never,
    maturityDate: '2030-01-02',
    product: 'CDB' as never,
    taxExempt: false,
  },
};
const rate = { annualRate: '12', mode: 'PREFIXED' as never, startDate: '2026-01-02' };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T15:00:00Z'));
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(new Map());
});

afterEach(() => jest.useRealTimers());

it('SHOULD convert a manual asset with its first rate', async () => {
  await setup.execute({ ...base, rate });

  expect(spies.saveFixedIncomeTerms).toHaveBeenCalledWith(
    expect.objectContaining({
      assetId: 'asset-fi',
      convert: true,
      rate: expect.objectContaining({ effectiveRate: '12.000000', startDate: '2026-01-02' }),
    }),
  );
});

it('SHOULD edit the terms of a calculated title without converting', async () => {
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );

  await setup.execute(base);

  expect(spies.saveFixedIncomeTerms).toHaveBeenCalledWith(
    expect.objectContaining({ convert: false, rate: undefined }),
  );
});

it('SHOULD require a rate to convert AND at least one contribution', async () => {
  await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);

  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture({ operations: [] }));

  await expect(setup.execute({ ...base, rate })).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse an asset that is not fixed income OR not in BRL', async () => {
  spies.findAssetById.mockResolvedValue({
    ...fixedIncomeDetailFixture(),
    assetClass: InvestmentAssetClass.BR_STOCK,
  });

  await expect(setup.execute({ ...base, rate })).rejects.toThrow(UnprocessableEntityException);

  spies.findAssetById.mockResolvedValue({ ...fixedIncomeDetailFixture(), currency: 'USD' });

  await expect(setup.execute({ ...base, rate })).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse a rate that starts after the first contribution AND a rate on an existing title', async () => {
  await expect(
    setup.execute({ ...base, rate: { ...rate, startDate: '2026-02-01' } }),
  ).rejects.toThrow(UnprocessableEntityException);

  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );

  await expect(setup.execute({ ...base, rate })).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD answer 404 for an asset the caller cannot reach', async () => {
  spies.findAssetById.mockResolvedValue(assetFixture({ ownerId: 'someone-else' }) as never);

  await expect(setup.execute({ ...base, rate })).rejects.toThrow(NotFoundException);
});
