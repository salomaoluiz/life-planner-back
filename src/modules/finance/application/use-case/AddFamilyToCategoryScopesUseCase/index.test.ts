import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD call the repository with the addScope arguments', async () => {
  await expect(setup.execute(mocks.input)).resolves.toBeUndefined();
  expect(mocks.categoryRepository.addScope).toHaveBeenCalledWith({
    creatorId: 'user-id',
    owner: { owner: 'FAMILY', ownerId: 'family-id' },
  });
});

it('SHOULD throw ValidationError AND touch nothing WHEN an id is empty', async () => {
  await expect(setup.execute({ familyId: 'family-id', userId: '' } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.categoryRepository.addScope).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure', async () => {
  mocks.categoryRepository.addScope.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.input)).rejects.toThrow('db down');
});
