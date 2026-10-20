import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './finance-access.service.mocks';

it('SHOULD return the caller as USER plus every family as FAMILY with its archived flag', async () => {
  const result = await setup.resolve(mocks.userId);

  expect(mocks.getUserFamilyAccessUseCase.execute).toHaveBeenCalledWith(mocks.userId);
  expect(result).toEqual([
    { owner: OwnerType.USER, ownerId: mocks.userId },
    { archived: false, owner: OwnerType.FAMILY, ownerId: mocks.familyIds[0] },
    { archived: true, owner: OwnerType.FAMILY, ownerId: mocks.familyIds[1] },
  ]);
});

it('SHOULD return only the USER owner WHEN the caller has no family', async () => {
  mocks.getUserFamilyAccessUseCase.execute.mockResolvedValueOnce([]);

  expect(await setup.resolve(mocks.userId)).toEqual([
    { owner: OwnerType.USER, ownerId: mocks.userId },
  ]);
});

it('SHOULD fail the whole request WHEN the family lookup fails (no partial result)', async () => {
  mocks.getUserFamilyAccessUseCase.execute.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.resolve(mocks.userId)).rejects.toThrow('db down');
});
