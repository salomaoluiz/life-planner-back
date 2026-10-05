import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { toOwnerWhere } from './index';

it('SHOULD build an OR over (owner, owner_id) pairs', () => {
  const result = toOwnerWhere([
    { owner: OwnerType.USER, ownerId: 'user-id' },
    { owner: OwnerType.FAMILY, ownerId: 'family-id' },
  ]);

  expect(result).toEqual({
    OR: [
      { owner: 'USER', owner_id: 'user-id' },
      { owner: 'FAMILY', owner_id: 'family-id' },
    ],
  });
});
