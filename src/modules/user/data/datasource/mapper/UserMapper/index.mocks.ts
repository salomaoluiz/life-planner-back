import { faker } from '@faker-js/faker';

import { User } from '@db/client';
import UserEntity from '@user/domain/entity/UserEntity';

// region Mocks

const rawUserMock: User = {
  created_at: new Date(),
  email: faker.internet.email(),
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  password_hash: faker.string.alphanumeric(20),
  photo_url: faker.internet.url(),
  updated_at: new Date(),
};

const entityMock = new UserEntity({
  email: faker.internet.email(),
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  passwordHash: faker.string.alphanumeric(20),
  photoUrl: faker.internet.url(),
});

// endregion

export const mocks = {
  entity: entityMock,
  entityWithoutPhoto: new UserEntity({ ...entityMock, photoUrl: undefined }),
  raw: rawUserMock,
  rawWithoutPhoto: { ...rawUserMock, photo_url: null },
};
