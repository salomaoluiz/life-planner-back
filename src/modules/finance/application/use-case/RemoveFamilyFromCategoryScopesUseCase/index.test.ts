import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD call the repository with the removeScope arguments', async () => {
  await expect(setup.execute(mocks.input)).resolves.toBeUndefined();
  expect(mocks.categoryRepository.removeScope).toHaveBeenCalledWith({
    owner: 'FAMILY',
    ownerId: 'family-id',
  });
});

it('SHOULD throw ValidationError AND touch nothing WHEN an id is empty', async () => {
  await expect(setup.execute({ familyId: '' } as never)).rejects.toThrow(ValidationError);
  expect(mocks.categoryRepository.removeScope).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure', async () => {
  mocks.categoryRepository.removeScope.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.input)).rejects.toThrow('db down');
});
