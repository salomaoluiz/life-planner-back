import {
  belongsToOwner,
  categoryScopeKind,
  isVisibleTo,
  sameScopes,
  visibleScopes,
} from '@finance/domain/entity/CategoryScope';
import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const personal = { owner: OwnerType.USER, ownerId: 'user-1' };
const familyA = { owner: OwnerType.FAMILY, ownerId: 'family-a' };
const familyB = { owner: OwnerType.FAMILY, ownerId: 'family-b' };
const stranger = { owner: OwnerType.FAMILY, ownerId: 'family-x' };

function allCategory() {
  return new CategoryEntityFixture().withAllScopes([personal, familyA, familyB], 'user-1').build();
}

describe('categoryScopeKind', () => {
  it('SHOULD return ALL WHEN the category follows every scope of its creator', () => {
    expect(categoryScopeKind(allCategory())).toBe('ALL');
  });

  it.each([
    [OwnerType.USER, 'PERSONAL'],
    [OwnerType.FAMILY, 'FAMILY'],
  ])('SHOULD return the owner kind for a single-scope %s category', (owner, expected) => {
    expect(categoryScopeKind(new CategoryEntityFixture().withOwner(owner).build())).toBe(expected);
  });
});

describe('isVisibleTo', () => {
  it('SHOULD be true WHEN only one family scope of an ALL category is accessible', () => {
    expect(isVisibleTo(allCategory(), [familyB])).toBe(true);
  });

  it('SHOULD be false WHEN none of the scopes is accessible', () => {
    expect(isVisibleTo(allCategory(), [stranger])).toBe(false);
  });
});

describe('belongsToOwner', () => {
  it.each([personal, familyA, familyB])('SHOULD be true for each scope of an ALL category', (t) => {
    expect(belongsToOwner(allCategory(), t)).toBe(true);
  });

  it('SHOULD be false for a family outside the scopes', () => {
    expect(belongsToOwner(allCategory(), stranger)).toBe(false);
  });
});

describe('visibleScopes', () => {
  it('SHOULD drop the scopes the caller cannot access', () => {
    expect(visibleScopes(allCategory(), [personal, familyB, stranger])).toEqual([
      personal,
      familyB,
    ]);
  });
});

describe('sameScopes', () => {
  it('SHOULD ignore the order of the scopes', () => {
    const a = new CategoryEntityFixture().withAllScopes([personal, familyA], 'user-1').build();
    const b = new CategoryEntityFixture().withAllScopes([familyA, personal], 'user-1').build();

    expect(sameScopes(a, b)).toBe(true);
  });

  it('SHOULD be false WHEN a scope differs', () => {
    const a = new CategoryEntityFixture().withAllScopes([personal, familyA], 'user-1').build();

    expect(sameScopes(a, allCategory())).toBe(false);
  });

  it('SHOULD compare owner and ownerId for single-scope categories', () => {
    const a = new CategoryEntityFixture().withOwner(OwnerType.USER).withOwnerId('u').build();
    const b = new CategoryEntityFixture().withOwner(OwnerType.USER).withOwnerId('u').build();

    expect(sameScopes(a, b)).toBe(true);
  });
});
