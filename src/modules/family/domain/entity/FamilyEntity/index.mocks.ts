import FamilyEntity from './index';

// region Mocks

const paramsMock: FamilyEntity = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  id: 'family-uuid-123',
  name: 'The Smiths',
  ownerId: 'owner-uuid-456',
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
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
