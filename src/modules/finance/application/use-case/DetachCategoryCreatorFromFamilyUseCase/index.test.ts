import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD call the repository with the detachFamilyScope arguments', async () => {
  expect(await setup.execute(mocks.input)).toBe(2);
  expect(mocks.categoryRepository.detachFamilyScope).toHaveBeenCalledWith({
    creatorId: 'user-id',
    familyId: 'family-id',
  });
});

it('SHOULD throw ValidationError AND touch nothing WHEN an id is empty', async () => {
  await expect(setup.execute({ familyId: 'family-id', userId: '' } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.categoryRepository.detachFamilyScope).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure', async () => {
  mocks.categoryRepository.detachFamilyScope.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.input)).rejects.toThrow('db down');
});
