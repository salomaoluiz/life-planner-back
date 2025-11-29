import { faker } from '@faker-js/faker';

import FamilyMemberEntity from '@family/domain/entity/FamilyMemberEntity';

class FamilyMemberEntityFixture {
  value = {} as FamilyMemberEntity;

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
      familyId: faker.string.uuid(),
      id: faker.string.uuid(),
      // Optional properties
      joinedAt: undefined,
      userId: undefined,
    };
  }

  withEmail(email: string) {
    this.value.email = email;
    return this;
  }

  withFamilyId(familyId: string) {
    this.value.familyId = familyId;
    return this;
  }

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  // Optional properties

  withJoinedAt(joinedAt: Date = faker.date.recent({ days: 1 })) {
    this.value.joinedAt = joinedAt;
    return this;
  }

  withUserId(userId: string = faker.string.uuid()) {
    this.value.userId = userId;
    return this;
  }
}

export default FamilyMemberEntityFixture;
