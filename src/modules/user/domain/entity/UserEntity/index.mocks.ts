import { faker } from '@faker-js/faker';

import UserEntity from './';

// region Mocks

const dateMock = new Date('2025-01-01T12:00:00Z');

const paramsMock: UserEntity = {
  email: 'test@gmail.com',
  id: faker.string.uuid(),
  name: faker.person.firstName(),
  passwordHash: faker.string.alphanumeric(20),
  // Optional properties
  photoUrl: faker.internet.url(),
};

const mandatoryParamsMock: UserEntity = {
  email: paramsMock.email,
  id: paramsMock.id,
  name: paramsMock.name,
  passwordHash: paramsMock.passwordHash,
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new UserEntity(params);
}

const mocks = {
  date: dateMock,
  mandatoryParams: mandatoryParamsMock,
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
