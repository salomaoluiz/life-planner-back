import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';

// region Mocks

// root --> childA --> grandchild
//      \-> childB
// other (unrelated root)
const fixture = new CategoryEntityFixture();
const root = fixture.withId('root').build();
const childA = fixture.withId('childA').withParentId('root').withDepthLevel(1).build();
const childB = fixture.withId('childB').withParentId('root').withDepthLevel(1).build();
const grandchild = fixture.withId('grandchild').withParentId('childA').withDepthLevel(2).build();
const other = fixture.withId('other').build();

// endregion Mocks

const mocks = {
  categories: [other, grandchild, childB, root, childA],
  childA,
  childB,
  grandchild,
  other,
  root,
};
const spies = {};

export { mocks, spies };
