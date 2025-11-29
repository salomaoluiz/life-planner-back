import { faker } from '@faker-js/faker';

import CategoryEntity from '@finance/domain/entity/CategoryEntity';

class CategoryEntityFixture {
  value = {} as CategoryEntity;

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
      icon: 'House',
      id: faker.string.uuid(),
      name: faker.commerce.product(),
      ownerId: faker.string.uuid(),
      // Optional properties
      depthLevel: undefined,
      parentId: undefined,
    } as CategoryEntity;

    return this;
  }

  withIcon(icon: string) {
    this.value.icon = icon;

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

  // Optional properties

  withDepthLevel(depthLevel: number = 1) {
    this.value.depthLevel = depthLevel;

    return this;
  }

  withParentId(parentId: string = faker.string.uuid()) {
    this.value.parentId = parentId;

    return this;
  }
}

export default CategoryEntityFixture;
