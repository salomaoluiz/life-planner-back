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

  withCreatedAt(createdAt: Date) {
    this.value.createdAt = createdAt;
    return this;
  }

  withDefault() {
    this.value = {
      createdAt: faker.date.past(),
      id: faker.string.uuid(),
      name: `Family ${faker.person.lastName()}`,
      ownerId: faker.string.uuid(),
      updatedAt: faker.date.recent(),
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

  withUpdatedAt(updatedAt: Date) {
    this.value.updatedAt = updatedAt;
    return this;
  }
}

export default FamilyEntityFixture;
