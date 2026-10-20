import { faker } from '@faker-js/faker';

import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
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
    const ownerId = faker.string.uuid();

    this.value = {
      allScopes: false,
      createdAt: faker.date.past(),
      creatorId: undefined,
      depthLevel: 0,
      icon: 'folder',
      iconColor: '#000000',
      id: faker.string.uuid(),
      name: faker.commerce.department(),
      owner: OwnerType.USER,
      ownerId,
      parentId: undefined,
      scopes: [{ owner: OwnerType.USER, ownerId }],
      status: AccountStatus.ACTIVE,
      type: TransactionType.EXPENSE,
      updatedAt: faker.date.recent(),
    };
    return this;
  }

  // An ALL category: `owner/ownerId` is the creator's Personal scope, which must be one of `scopes`.
  withAllScopes(scopes: OwnerAccess[], creatorId: string) {
    this.value.allScopes = true;
    this.value.creatorId = creatorId;
    this.value.owner = OwnerType.USER;
    this.value.ownerId = creatorId;
    this.value.scopes = scopes;
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
    this.value.scopes = [{ owner, ownerId: this.value.ownerId }];
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    this.value.scopes = [{ owner: this.value.owner, ownerId }];
    return this;
  }

  withParentId(parentId?: string) {
    this.value.parentId = parentId;
    return this;
  }

  withStatus(status: AccountStatus) {
    this.value.status = status;
    return this;
  }

  withType(type: TransactionType) {
    this.value.type = type;
    return this;
  }
}

export default CategoryEntityFixture;
