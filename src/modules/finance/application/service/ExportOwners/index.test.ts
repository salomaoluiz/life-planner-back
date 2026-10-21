import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { resolveExportOwners } from './index';

const owners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { archived: true, owner: OwnerType.FAMILY, ownerId: 'archived-family' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];

describe('resolveExportOwners', () => {
  it('SHOULD return every owner, archived families included, for ALL', () => {
    expect(resolveExportOwners(owners, 'ALL')).toEqual(owners);
  });

  it('SHOULD return only the user for USER', () => {
    expect(resolveExportOwners(owners, 'USER')).toEqual([owners[0]]);
  });

  it('SHOULD return the chosen family, archived or not, for FAMILY', () => {
    expect(resolveExportOwners(owners, 'FAMILY', 'archived-family')).toEqual([owners[1]]);
  });

  it('SHOULD drop a family the caller cannot reach', () => {
    expect(resolveExportOwners(owners, 'FAMILY', 'stranger')).toEqual([]);
  });
});
