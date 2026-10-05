import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';

import { collectDescendants } from './index';
import { mocks } from './index.mocks';

describe('collectDescendants', () => {
  it('SHOULD return every descendant at any depth, in any input order, WITHOUT the root', () => {
    const result = collectDescendants(mocks.categories, 'root');

    expect(result.map((category) => category.id).sort()).toEqual([
      'childA',
      'childB',
      'grandchild',
    ]);
  });

  it('SHOULD return only the subtree of a middle node', () => {
    expect(collectDescendants(mocks.categories, 'childA').map((c) => c.id)).toEqual(['grandchild']);
  });

  it.each([
    ['a leaf', 'grandchild'],
    ['an unrelated root', 'other'],
    ['an unknown id', 'missing'],
  ])('SHOULD return [] for %s', (_label, id) => {
    expect(collectDescendants(mocks.categories, id)).toEqual([]);
  });

  it('SHOULD terminate on corrupted data that contains a cycle', () => {
    const fixture = new CategoryEntityFixture();
    const a = fixture.withId('a').withParentId('b').build();
    const b = fixture.withId('b').withParentId('a').build();

    expect(collectDescendants([a, b], 'a').map((c) => c.id)).toEqual(['b']);
  });
});
