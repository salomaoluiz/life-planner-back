import { ValidationError } from '@shared/domain/error/ValidationError';

import { setup, spies } from './index.mocks';

it('SHOULD answer whether the owner has assets', async () => {
  spies.existsByOwner.mockResolvedValue(true);

  expect(await setup.execute({ owner: 'FAMILY' as never, ownerId: 'fam' })).toBe(true);
  expect(spies.existsByOwner).toHaveBeenCalledWith({ owner: 'FAMILY', ownerId: 'fam' });
});

it('SHOULD reject an invalid owner', async () => {
  await expect(setup.execute({ owner: 'NOPE' as never, ownerId: '' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});
