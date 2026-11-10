import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import { assetFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentAssetStatus } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.owners, id: mocks.asset.id };

beforeEach(() => {
  spies.findAssetById.mockResolvedValue(mocks.detail);
  spies.findAssetByTicker.mockResolvedValue(undefined);
  spies.updateAsset.mockResolvedValue(mocks.asset);
});

it('SHOULD rename the asset AND return the refreshed view', async () => {
  const view = await setup.execute({ ...base, name: 'New name' });

  expect(spies.updateAsset).toHaveBeenCalledWith(
    expect.objectContaining({ id: mocks.asset.id, name: 'New name' }),
  );
  expect(view.asset.id).toBe(mocks.asset.id);
});

it('SHOULD answer 404 for a missing asset or one the caller cannot reach', async () => {
  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, name: 'x' })).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'someone-else' });
  await expect(setup.execute({ ...base, name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 WHEN the asset belongs to an archived family', async () => {
  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    owner: OwnerType.FAMILY,
    ownerId: 'fam',
  });

  await expect(
    setup.execute({
      accessibleOwners: [{ archived: true, owner: OwnerType.FAMILY, ownerId: 'fam' }],
      id: mocks.asset.id,
      name: 'x',
    }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD answer 403 WHEN the destination owner is not accessible AND check it is writable', async () => {
  await expect(
    setup.execute({ ...base, owner: OwnerType.FAMILY, ownerId: 'nope' }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  await expect(
    setup.execute({
      accessibleOwners: [
        ...mocks.owners,
        { archived: true, owner: OwnerType.FAMILY, ownerId: 'fam' },
      ],
      id: mocks.asset.id,
      owner: OwnerType.FAMILY,
      ownerId: 'fam',
    }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD lock class and currency after the first operation', async () => {
  spies.findAssetById.mockResolvedValue(mocks.detailWithOperation);

  await expect(
    setup.execute({ ...base, assetClass: InvestmentAssetClass.BR_REIT }),
  ).rejects.toThrow(
    new UnprocessableEntityException("Class and currency can't change after the first operation"),
  );
  await expect(setup.execute({ ...base, currency: 'USD' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
  await expect(
    setup.execute({ ...base, assetClass: mocks.asset.assetClass, currency: 'BRL', name: 'ok' }),
  ).resolves.toBeDefined();
});

it('SHOULD change class and currency while there are no operations', async () => {
  await setup.execute({ ...base, assetClass: InvestmentAssetClass.FOREIGN_STOCK, currency: 'USD' });

  expect(spies.updateAsset).toHaveBeenCalledWith(
    expect.objectContaining({ assetClass: 'FOREIGN_STOCK', currency: 'USD' }),
  );
});

it('SHOULD require a ticker for a ticker class even WHEN clearing it', async () => {
  await expect(setup.execute({ ...base, ticker: null })).rejects.toBeInstanceOf(ValidationError);

  spies.findAssetById.mockResolvedValue({ ...mocks.detail, ticker: 'ITSA4' });
  await expect(
    setup.execute({ ...base, assetClass: InvestmentAssetClass.PRIVATE, ticker: null }),
  ).resolves.toBeDefined();
});

it('SHOULD answer 409 WHEN another asset of the owner has the new ticker', async () => {
  spies.findAssetByTicker.mockResolvedValue(assetFixture({ ticker: 'VALE3' }));

  await expect(setup.execute({ ...base, ticker: 'vale3' })).rejects.toBeInstanceOf(
    ConflictException,
  );
});

it('SHOULD re-check the ticker WHEN only the owner changes AND skip it for an unchanged ticker', async () => {
  const owners = [...mocks.owners, { owner: OwnerType.FAMILY, ownerId: 'fam' }];

  await setup.execute({
    accessibleOwners: owners,
    id: mocks.asset.id,
    owner: OwnerType.FAMILY,
    ownerId: 'fam',
  });
  expect(spies.findAssetByTicker).toHaveBeenCalledWith(OwnerType.FAMILY, 'fam', 'ITSA4');

  spies.findAssetByTicker.mockClear();
  await setup.execute({ ...base, ticker: 'ITSA4' });
  await setup.execute({ ...base, name: 'again' });
  expect(spies.findAssetByTicker).not.toHaveBeenCalled();
});

it('SHOULD ignore the asset itself as a ticker clash', async () => {
  spies.findAssetByTicker.mockResolvedValue({ ...mocks.asset });

  await expect(setup.execute({ ...base, ticker: 'NEW1' })).resolves.toBeDefined();
});

it('SHOULD stamp the archive day once AND clear it on reactivation', async () => {
  await setup.execute({ ...base, status: InvestmentAssetStatus.ARCHIVED });
  expect(spies.updateAsset.mock.calls[0][0].archivedAt).toBeInstanceOf(Date);

  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await setup.execute({ ...base, status: InvestmentAssetStatus.ARCHIVED });
  expect(spies.updateAsset.mock.calls[1][0].archivedAt).toBeUndefined();

  await setup.execute({ ...base, status: InvestmentAssetStatus.ACTIVE });
  expect(spies.updateAsset.mock.calls[2][0].archivedAt).toBeNull();
});

it('SHOULD reject an empty update AND an owner without ownerId', async () => {
  await expect(setup.execute(base)).rejects.toBeInstanceOf(ValidationError);
  await expect(setup.execute({ ...base, owner: OwnerType.USER })).rejects.toBeInstanceOf(
    ValidationError,
  );
});

it('SHOULD fall back to the updated asset WHEN the re-read finds nothing', async () => {
  spies.findAssetById.mockResolvedValueOnce(mocks.detail).mockResolvedValueOnce(undefined);

  await expect(setup.execute({ ...base, name: 'x' })).resolves.toMatchObject({ operationCount: 0 });
});

it('SHOULD validate the new ticker WHEN the ticker changes (spec 104 FR 25)', async () => {
  await setup.execute({ ...base, ticker: 'HGLG11' });

  expect(quoteSpies.validate).toHaveBeenCalledWith(mocks.detail.assetClass, 'HGLG11');
});

it('SHOULD NOT call the quote source WHEN only the name changes', async () => {
  await setup.execute({ ...base, name: 'Renamed' });

  expect(quoteSpies.validate).not.toHaveBeenCalled();
});

it('SHOULD NOT update WHEN the new ticker is rejected', async () => {
  quoteSpies.validate.mockRejectedValue(
    new UnprocessableEntityException({ code: 'TICKER_NOT_FOUND' }),
  );

  await expect(setup.execute({ ...base, ticker: 'XYZW9' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
  expect(spies.updateAsset).not.toHaveBeenCalled();
});
