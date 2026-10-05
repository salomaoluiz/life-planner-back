import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { hasOwnerAccess, narrowOwners } from './index';
import { mocks } from './index.mocks';

describe('hasOwnerAccess', () => {
  it('SHOULD allow the user own data AND the data of a family the user belongs to', () => {
    expect(
      hasOwnerAccess(mocks.accessibleOwners, { owner: OwnerType.USER, ownerId: mocks.userId }),
    ).toBe(true);
    expect(
      hasOwnerAccess(mocks.accessibleOwners, { owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
    ).toBe(true);
  });

  it.each([
    ['another family', { owner: OwnerType.FAMILY, ownerId: mocks.otherFamilyId }],
    ['a user id used as FAMILY', { owner: OwnerType.FAMILY, ownerId: mocks.userId }],
    ['a family id used as USER', { owner: OwnerType.USER, ownerId: mocks.familyId }],
  ])('SHOULD deny %s', (_label, target) => {
    expect(hasOwnerAccess(mocks.accessibleOwners, target)).toBe(false);
  });

  it('SHOULD deny everything WHEN the accessible list is empty', () => {
    expect(hasOwnerAccess([], { owner: OwnerType.USER, ownerId: mocks.userId })).toBe(false);
  });
});

describe('narrowOwners', () => {
  it('SHOULD return every accessible owner WHEN no ownerIds are requested', () => {
    expect(narrowOwners(mocks.accessibleOwners)).toEqual(mocks.accessibleOwners);
  });

  it('SHOULD keep only the requested owners', () => {
    expect(narrowOwners(mocks.accessibleOwners, [mocks.familyId])).toEqual([
      { owner: OwnerType.FAMILY, ownerId: mocks.familyId },
    ]);
  });

  it('SHOULD silently ignore requested ids the caller cannot access (never an error)', () => {
    expect(narrowOwners(mocks.accessibleOwners, [mocks.otherFamilyId])).toEqual([]);
    expect(narrowOwners(mocks.accessibleOwners, [mocks.otherFamilyId, mocks.userId])).toEqual([
      { owner: OwnerType.USER, ownerId: mocks.userId },
    ]);
  });

  it('SHOULD return an empty list WHEN an empty ownerIds array is requested', () => {
    expect(narrowOwners(mocks.accessibleOwners, [])).toEqual([]);
  });
});
