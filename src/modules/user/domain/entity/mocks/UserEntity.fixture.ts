import { faker } from '@faker-js/faker';

import UserEntity from '@user/domain/entity/UserEntity';

class UserEntityFixture {
  value = {} as UserEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withDefault() {
    this.value = {
      email: faker.internet.email(),
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      photoUrl: faker.image.personPortrait(),
    };
    return this;
  }

  // Builder methods

  withEmail(email: string) {
    this.value.email = email;
    return this;
  }

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  withName(name: string) {
    this.value.name = name;
    return this;
  }

  withPhotoUrl(photoUrl: string) {
    this.value.photoUrl = photoUrl;
    return this;
  }
}

export default UserEntityFixture;
