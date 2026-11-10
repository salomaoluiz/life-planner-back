import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetStatus } from '@investment/domain/enum';

import { mocks, setup, spies } from './index.mocks';

const valuation = valuationFixture({ assetId: mocks.asset.id });
const base = { accessibleOwners: mocks.owners, id: valuation.id };

beforeEach(() => {
  spies.findValuationById.mockResolvedValue(valuation);
  spies.findAssetById.mockResolvedValue(mocks.detail);
});

it('SHOULD delete the valuation', async () => {
  await setup.execute(base);

  expect(spies.deleteValuation).toHaveBeenCalledWith(valuation.id);
});

it('SHOULD answer 404 for a missing valuation or an unreachable asset', async () => {
  spies.findValuationById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived asset', async () => {
  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });

  await expect(setup.execute(base)).rejects.toBeInstanceOf(UnprocessableEntityException);
  expect(spies.deleteValuation).not.toHaveBeenCalled();
});

it('SHOULD refuse WHEN the asset is a calculated title (spec 105)', async () => {
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );

  await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);
  expect(spies.deleteValuation).not.toHaveBeenCalled();
});
