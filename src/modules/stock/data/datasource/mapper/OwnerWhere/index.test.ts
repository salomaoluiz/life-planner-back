import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { toOwnerWhere } from './index';

it('SHOULD build one OR clause per (owner, owner_id) pair', () => {
  expect(
    toOwnerWhere([
      { owner: OwnerType.USER, ownerId: 'u' },
      { owner: OwnerType.FAMILY, ownerId: 'f' },
    ]),
  ).toEqual({
    OR: [
      { owner: 'USER', owner_id: 'u' },
      { owner: 'FAMILY', owner_id: 'f' },
    ],
  });
});
