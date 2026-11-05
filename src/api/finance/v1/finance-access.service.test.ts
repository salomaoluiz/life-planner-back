import { resolvedAccessStore } from '@api/finance/v1/finance-access.service';
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

it('SHOULD return the owners AND the family names from ONE family read (spec 083)', async () => {
  const result = await setup.resolveWithNames(mocks.userId);

  expect(mocks.getUserFamilyAccessUseCase.execute).toHaveBeenCalledTimes(1);
  expect(result.accessibleOwners).toHaveLength(3);
  expect(result.familyNames).toEqual({
    [mocks.familyIds[0]]: 'Casa',
    [mocks.familyIds[1]]: 'Sítio',
  });
});

it('SHOULD return no family names WHEN the caller has no family', async () => {
  mocks.getUserFamilyAccessUseCase.execute.mockResolvedValueOnce([]);

  expect((await setup.resolveWithNames(mocks.userId)).familyNames).toEqual({});
});

it('SHOULD reuse the access the ETag guard already read WHEN it runs inside the store (spec 092)', async () => {
  const preloaded = {
    accessibleOwners: [{ owner: OwnerType.USER, ownerId: mocks.userId }],
    familyNames: {},
    userId: mocks.userId,
  };

  const result = await resolvedAccessStore.run(preloaded, async () =>
    setup.resolveWithNames(mocks.userId),
  );

  expect(mocks.getUserFamilyAccessUseCase.execute).not.toHaveBeenCalled();
  expect(result).toEqual({ accessibleOwners: preloaded.accessibleOwners, familyNames: {} });
});

it('SHOULD read the families WHEN the stored access belongs to another user', async () => {
  const preloaded = { accessibleOwners: [], familyNames: {}, userId: 'someone-else' };

  await resolvedAccessStore.run(preloaded, async () => setup.resolveWithNames(mocks.userId));

  expect(mocks.getUserFamilyAccessUseCase.execute).toHaveBeenCalledTimes(1);
});
