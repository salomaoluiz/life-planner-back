import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { hasOwnerAccess, narrowOwners } from './index';
import { mocks } from './index.mocks';

describe('hasOwnerAccess', () => {
  it('SHOULD be true WHEN the exact (owner, ownerId) pair is accessible', () => {
    expect(hasOwnerAccess(mocks.accessible, mocks.familyAccess)).toBe(true);
  });

  it('SHOULD be false WHEN only the id matches under another owner type', () => {
    expect(hasOwnerAccess(mocks.accessible, { owner: OwnerType.FAMILY, ownerId: 'user-id' })).toBe(
      false,
    );
  });

  it('SHOULD be false WHEN nothing is accessible', () => {
    expect(hasOwnerAccess([], mocks.userAccess)).toBe(false);
  });
});

describe('narrowOwners', () => {
  it('SHOULD return every owner WHEN no ownerId is given', () => {
    expect(narrowOwners(mocks.accessible)).toEqual(mocks.accessible);
  });

  it('SHOULD keep only the matching owner', () => {
    expect(narrowOwners(mocks.accessible, 'family-id')).toEqual([mocks.familyAccess]);
  });

  it('SHOULD return [] (never reject) WHEN the ownerId is not accessible', () => {
    expect(narrowOwners(mocks.accessible, 'someone-else')).toEqual([]);
  });
});
