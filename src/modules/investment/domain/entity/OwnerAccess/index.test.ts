import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { hasOwnerAccess, narrowOwners } from './index';

const owners = [
  { owner: OwnerType.USER, ownerId: 'u' },
  { archived: true, owner: OwnerType.FAMILY, ownerId: 'f1' },
  { owner: OwnerType.FAMILY, ownerId: 'f2' },
];

it('SHOULD match an owner by type and id', () => {
  expect(hasOwnerAccess(owners, { owner: OwnerType.USER, ownerId: 'u' })).toBe(true);
  expect(hasOwnerAccess(owners, { owner: OwnerType.FAMILY, ownerId: 'u' })).toBe(false);
});

it('SHOULD skip archived families for "all" AND reach one by explicit id', () => {
  expect(narrowOwners(owners)).toEqual([owners[0], owners[2]]);
  expect(narrowOwners(owners, 'f1')).toEqual([owners[1]]);
  expect(narrowOwners(owners, 'nope')).toEqual([]);
});
