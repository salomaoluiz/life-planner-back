import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  assetId: mocks.asset.id,
  date: '2026-11-01',
  unitPrice: '10.61',
};
const valuation = valuationFixture({ date: '2026-11-01', unitPrice: Decimal8.parse('10.61') });

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T12:00:00Z'));
  spies.findAssetById.mockResolvedValue({ ...mocks.detail, valuations: [valuation] });
  spies.upsertValuation.mockResolvedValue(valuation);
});

afterEach(() => jest.useRealTimers());

it('SHOULD upsert the valuation AND return the asset with the new current value', async () => {
  const result = await setup.execute(input);

  expect(spies.upsertValuation.mock.calls[0][0]).toMatchObject({
    assetId: mocks.asset.id,
    date: '2026-11-01',
  });
  expect(spies.upsertValuation.mock.calls[0][0].unitPrice.toString()).toBe('10.61');
  expect(result.valuation).toBe(valuation);
  expect(result.asset.position.currentUnitPrice?.toString()).toBe('10.61');
});

it('SHOULD refuse a future date OR a non positive price with 400', async () => {
  await expect(setup.execute({ ...input, date: '2026-11-10' })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(setup.execute({ ...input, unitPrice: '0' })).rejects.toBeInstanceOf(ValidationError);
});

it('SHOULD answer 404 for an unreachable asset AND 422 for an archived one', async () => {
  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({
    ...mocks.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await expect(setup.execute(input)).rejects.toBeInstanceOf(UnprocessableEntityException);
  expect(spies.upsertValuation).not.toHaveBeenCalled();
});

it('SHOULD answer 404 WHEN the asset disappears before the re-read', async () => {
  spies.findAssetById.mockResolvedValueOnce(mocks.detail).mockResolvedValueOnce(undefined);

  await expect(setup.execute(input)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD refuse WHEN the asset is a calculated title (spec 105)', async () => {
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );

  await expect(setup.execute({ ...input, assetId: 'asset-fi' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(spies.upsertValuation).not.toHaveBeenCalled();
});
