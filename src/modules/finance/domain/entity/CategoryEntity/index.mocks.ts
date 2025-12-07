import CategoryEntity from './index';

// region Mocks

const paramsMock: CategoryEntity = {
  depthLevel: 1,
  icon: 'icon-uuid',
  id: 'category-id-123',
  name: 'Category Name',
  ownerId: 'owner-id-123',
  parentId: 'parent-category-id-123',
};

const mandatoryParamsMock: CategoryEntity = {
  icon: 'icon-uuid-2',
  id: 'category-id-456',
  name: 'Mandatory Category',
  ownerId: 'owner-id-456',
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new CategoryEntity(params);
}

const mocks = {
  mandatoryParams: mandatoryParamsMock,
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
