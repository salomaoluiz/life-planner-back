import { faker } from '@faker-js/faker';

import FamilyEntity from '@family/domain/entity/FamilyEntity';

class FamilyEntityFixture {
  value = {} as FamilyEntity;

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
      id: faker.string.uuid(),
      name: `Family ${faker.person.lastName()}`,
      ownerId: faker.string.uuid(),
    };
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

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    return this;
  }
}

export default FamilyEntityFixture;
