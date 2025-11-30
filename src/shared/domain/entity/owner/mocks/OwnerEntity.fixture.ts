import { faker } from '@faker-js/faker';

import OwnerEntity, { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class OwnerEntityFixture {
  value = {} as OwnerEntity;

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
      ownerId: faker.string.uuid(),
      type: faker.helpers.arrayElement([OwnerType.USER, OwnerType.FAMILY]),
    };
  }

  // Builder methods

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    return this;
  }

  withType(type: OwnerType) {
    this.value.type = type;
    return this;
  }
}

export default OwnerEntityFixture;
