import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD map the owner to snake_case columns AND return the count', async () => {
  const result = await setup.deleteAllByOwner({ owner: OwnerType.FAMILY, ownerId: 'family-id' });

  expect(result).toBe(7);
  expect(mocks.ownerDataDatasource.deleteAllByOwner).toHaveBeenCalledWith({
    owner: 'FAMILY',
    owner_id: 'family-id',
  });
});
