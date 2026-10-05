import { faker } from '@faker-js/faker';

import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

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
      createdAt: faker.date.past(),
      depthLevel: 0,
      icon: 'folder',
      iconColor: '#000000',
      id: faker.string.uuid(),
      name: faker.commerce.department(),
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      parentId: undefined,
      type: TransactionType.EXPENSE,
      updatedAt: faker.date.recent(),
    };
    return this;
  }

  withDepthLevel(depthLevel: number) {
    this.value.depthLevel = depthLevel;
    return this;
  }

  withIconColor(iconColor: string) {
    this.value.iconColor = iconColor;
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

  withOwner(owner: OwnerType) {
    this.value.owner = owner;
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    return this;
  }

  withParentId(parentId?: string) {
    this.value.parentId = parentId;
    return this;
  }

  withType(type: TransactionType) {
    this.value.type = type;
    return this;
  }
}

export default CategoryEntityFixture;
