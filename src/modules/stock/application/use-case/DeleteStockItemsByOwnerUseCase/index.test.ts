import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD purge the items AND the categories, locations and shopping lists of the owner, returning the items deleted', async () => {
  expect(await setup.execute({ owner: mocks.owner, ownerId: 'family-id' })).toBe(3);
  expect(mocks.stock.deleteByOwner).toHaveBeenCalledWith({
    owner: mocks.owner,
    ownerId: 'family-id',
  });
  expect(mocks.catalog.deleteByOwner).toHaveBeenCalledWith({
    owner: mocks.owner,
    ownerId: 'family-id',
  });
  expect(mocks.lists.deleteByOwner).toHaveBeenCalledWith({
    owner: mocks.owner,
    ownerId: 'family-id',
  });
});

it('SHOULD throw ValidationError WHEN the owner is unknown', async () => {
  await expect(setup.execute({ owner: 'NOPE', ownerId: 'x' } as never)).rejects.toThrow(
    ValidationError,
  );
});
