import FamilyEntity from './index';

// region Mocks

const paramsMock: FamilyEntity = {
  id: 'family-uuid-123',
  name: 'The Smiths',
  ownerId: 'owner-uuid-456',
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new FamilyEntity(params);
}

const mocks = {
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
