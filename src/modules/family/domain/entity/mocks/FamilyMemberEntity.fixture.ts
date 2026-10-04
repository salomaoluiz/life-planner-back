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

  withCreatedAt(createdAt: Date = faker.date.past()) {
    this.value.createdAt = createdAt;
    return this;
  }

  withDefault() {
    this.value = {
      createdAt: faker.date.past(),
      email: faker.internet.email(),
      familyId: faker.string.uuid(),
      id: faker.string.uuid(),
      // Optional properties
      inviteExpiresAt: undefined,
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

  withInviteExpiresAt(inviteExpiresAt: Date = faker.date.soon({ days: 7 })) {
    this.value.inviteExpiresAt = inviteExpiresAt;
    return this;
  }

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
