import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD sort by type, then by name case-insensitively', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(result.map((category) => category.name)).toEqual(['Auto', 'bakery', 'Zoo', 'Salary']);
});

it('SHOULD pass the owners and the type filter to the repository', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    ownerIds: [mocks.familyId],
    type: TransactionType.EXPENSE,
  });

  expect(mocks.categoryRepository.findCategories).toHaveBeenCalledWith({
    owners: [{ owner: OwnerType.FAMILY, ownerId: mocks.familyId }],
    type: TransactionType.EXPENSE,
  });
});

it('SHOULD return [] WITHOUT querying WHEN no requested id is accessible', async () => {
  expect(
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['stranger'] }),
  ).toEqual([]);
  expect(mocks.categoryRepository.findCategories).not.toHaveBeenCalled();
});

it('SHOULD throw ValidationError WHEN the type filter is unknown', async () => {
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, type: 'OTHER' } as never),
  ).rejects.toThrow(ValidationError);
});
