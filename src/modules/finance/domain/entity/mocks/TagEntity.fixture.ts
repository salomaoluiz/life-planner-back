import { faker } from '@faker-js/faker';

import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class TagEntityFixture {
  value = {} as TagEntity;

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
      creatorId: ownerId,
      id: faker.string.uuid(),
      name: faker.word.noun(),
      owner: OwnerType.USER,
      ownerId,
      scopes: [{ owner: OwnerType.USER, ownerId }],
      updatedAt: faker.date.recent(),
      usageCount: 0,
    };
    return this;
  }

  // An ALL tag: `owner/ownerId` is the creator's Personal scope, which must be one of `scopes`.
  withAllScopes(scopes: OwnerAccess[], creatorId: string) {
    this.value.allScopes = true;
    this.value.creatorId = creatorId;
    this.value.owner = OwnerType.USER;
    this.value.ownerId = creatorId;
    this.value.scopes = scopes;
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

  withUsageCount(usageCount: number) {
    this.value.usageCount = usageCount;
    return this;
  }
}

export default TagEntityFixture;
