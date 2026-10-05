import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it.each([true, false])('SHOULD return %s as answered by the repository', async (exists) => {
  mocks.stockRepository.existsByOwner.mockResolvedValueOnce(exists);

  expect(await setup.execute(mocks.input)).toBe(exists);
  expect(mocks.stockRepository.existsByOwner).toHaveBeenCalledWith(mocks.input);
});

it('SHOULD throw ValidationError WHEN the owner is invalid', async () => {
  await expect(setup.execute({ owner: 'GROUP', ownerId: 'x' } as never)).rejects.toThrow(
    ValidationError,
  );
});
