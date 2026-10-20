import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import {
  belongsToOwner,
  isVisibleTo,
  sameName,
  tagScopeKind,
  visibleScopes,
} from '@finance/domain/entity/TagScope';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const personal = { owner: OwnerType.USER, ownerId: 'user-1' };
const familyA = { owner: OwnerType.FAMILY, ownerId: 'family-a' };
const stranger = { owner: OwnerType.FAMILY, ownerId: 'family-x' };

function allTag() {
  return new TagEntityFixture().withAllScopes([personal, familyA], 'user-1').build();
}

describe('tagScopeKind', () => {
  it('SHOULD return ALL WHEN the tag follows every scope of its creator', () => {
    expect(tagScopeKind(allTag())).toBe('ALL');
  });

  it.each([
    [OwnerType.USER, 'PERSONAL'],
    [OwnerType.FAMILY, 'FAMILY'],
  ])('SHOULD return the owner kind for a single-scope %s tag', (owner, expected) => {
    expect(tagScopeKind(new TagEntityFixture().withOwner(owner).build())).toBe(expected);
  });
});

describe('isVisibleTo', () => {
  it('SHOULD be true WHEN one scope is accessible', () => {
    expect(isVisibleTo(allTag(), [familyA])).toBe(true);
  });

  it('SHOULD be false WHEN none of the scopes is accessible', () => {
    expect(isVisibleTo(allTag(), [stranger])).toBe(false);
  });
});

describe('belongsToOwner', () => {
  it('SHOULD match on owner type and id', () => {
    expect(belongsToOwner(allTag(), familyA)).toBe(true);
    expect(belongsToOwner(allTag(), stranger)).toBe(false);
  });
});

describe('visibleScopes', () => {
  it('SHOULD keep only the scopes the caller can access', () => {
    expect(visibleScopes(allTag(), [familyA, stranger])).toEqual([familyA]);
  });
});

describe('sameName', () => {
  it('SHOULD ignore case', () => {
    expect(sameName('Gasto Fixo', 'gasto fixo')).toBe(true);
    expect(sameName('gasto', 'gastos')).toBe(false);
  });
});
