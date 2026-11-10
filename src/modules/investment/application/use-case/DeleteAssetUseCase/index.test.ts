import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.owners, id: mocks.asset.id };

it('SHOULD delete the asset', async () => {
  spies.findAssetById.mockResolvedValue(mocks.detailWithOperation);

  await setup.execute(base);

  expect(spies.deleteAsset).toHaveBeenCalledWith(mocks.asset.id);
});

it('SHOULD answer 404 for a missing asset or one the caller cannot reach', async () => {
  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
  expect(spies.deleteAsset).not.toHaveBeenCalled();
});

it('SHOULD answer 422 WHEN the owner is an archived family', async () => {
  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    owner: OwnerType.FAMILY,
    ownerId: 'fam',
  });

  await expect(
    setup.execute({
      accessibleOwners: [{ archived: true, owner: OwnerType.FAMILY, ownerId: 'fam' }],
      id: mocks.asset.id,
    }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});
