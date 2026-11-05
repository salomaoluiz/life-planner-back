import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD clear only the favorites of that user pointing to accounts of the family', async () => {
  await setup.execute({ familyId: 'family-id', userId: 'user-id' });

  expect(mocks.favoriteRepository.clearByFamilyForUsers).toHaveBeenCalledWith({
    familyId: 'family-id',
    userIds: ['user-id'],
  });
});

it('SHOULD clear the favorites of every user WHEN no user is given (family deleted)', async () => {
  await setup.execute({ familyId: 'family-id' });

  expect(mocks.favoriteRepository.clearByFamilyForUsers).toHaveBeenCalledWith({
    familyId: 'family-id',
    userIds: undefined,
  });
});

it('SHOULD throw ValidationError WHEN familyId is empty', async () => {
  await expect(setup.execute({ familyId: '' })).rejects.toThrow(ValidationError);
});
