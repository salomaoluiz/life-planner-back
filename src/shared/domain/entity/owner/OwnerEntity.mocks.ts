import OwnerEntity, { OwnerType } from './OwnerEntity';

// region Mocks

const paramsMock = {
  id: 'uuid-1234',
  ownerId: 'uuid-5678',
  type: OwnerType.USER,
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new OwnerEntity(params);
}

const mocks = {
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
