import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { valuationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  assetClass: InvestmentAssetClass.BR_STOCK,
  name: 'Itausa PN',
  owner: OwnerType.USER,
  ownerId: 'user-1',
  ticker: 'itsa4',
};

beforeEach(() => {
  spies.findAssetByTicker.mockResolvedValue(undefined);
  spies.createAsset.mockResolvedValue(mocks.asset);
  spies.findAssetById.mockResolvedValue({ ...mocks.asset, operations: [], valuations: [] });
});

it('SHOULD store the ticker upper-cased with BRL as default currency', async () => {
  const view = await setup.execute(input);

  expect(spies.findAssetByTicker).toHaveBeenCalledWith(OwnerType.USER, 'user-1', 'ITSA4');
  expect(spies.createAsset).toHaveBeenCalledWith(
    expect.objectContaining({ currency: 'BRL', initialValuation: undefined, ticker: 'ITSA4' }),
  );
  expect(view.position.quantity.toString()).toBe('0');
  expect(view.operationCount).toBe(0);
});

it('SHOULD create the first valuation dated today WHEN a current unit price comes', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T12:00:00Z'));
  spies.findAssetById.mockResolvedValue({
    ...mocks.asset,
    operations: [],
    valuations: [valuationFixture({ date: '2026-11-09' })],
  });

  const view = await setup.execute({ ...input, currentUnitPrice: '10.53' });

  jest.useRealTimers();
  expect(spies.createAsset.mock.calls[0][0].initialValuation.date).toBe('2026-11-09');
  expect(spies.createAsset.mock.calls[0][0].initialValuation.unitPrice.toString()).toBe('10.53');
  expect(view.position.currentUnitPrice?.toString()).toBe('10.53');
});

it('SHOULD answer 409 WHEN the owner already has the ticker', async () => {
  spies.findAssetByTicker.mockResolvedValue(mocks.asset);

  await expect(setup.execute(input)).rejects.toThrow(
    new ConflictException('You already have this ticker'),
  );
  expect(spies.createAsset).not.toHaveBeenCalled();
});

it('SHOULD require a ticker for stock, FII and foreign stock but not for private', async () => {
  await expect(setup.execute({ ...input, ticker: undefined })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(
    setup.execute({ ...input, assetClass: InvestmentAssetClass.FOREIGN_STOCK, ticker: null }),
  ).rejects.toBeInstanceOf(ValidationError);
  await expect(
    setup.execute({ ...input, assetClass: InvestmentAssetClass.PRIVATE, ticker: undefined }),
  ).resolves.toBeDefined();
  expect(spies.findAssetByTicker).toHaveBeenCalledTimes(0);
});

it('SHOULD reject an invalid ticker, name AND price', async () => {
  await expect(setup.execute({ ...input, ticker: 'bad ticker!' })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(setup.execute({ ...input, name: '  ' })).rejects.toBeInstanceOf(ValidationError);
  await expect(setup.execute({ ...input, currentUnitPrice: '0' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD answer 403 WHEN the owner is not accessible', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});

it('SHOULD answer 422 WHEN the owner is an archived family', async () => {
  await expect(
    setup.execute({
      ...input,
      accessibleOwners: [{ archived: true, owner: OwnerType.FAMILY, ownerId: 'fam' }],
      owner: OwnerType.FAMILY,
      ownerId: 'fam',
    }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD fall back to an empty detail WHEN the asset cannot be re-read', async () => {
  spies.findAssetById.mockResolvedValue(undefined);

  await expect(setup.execute(input)).resolves.toMatchObject({ operationCount: 0 });
});
