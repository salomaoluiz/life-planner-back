import { faker } from '@faker-js/faker';

import UserSessionEntity, { IUserSessionEntity } from '@user/domain/entity/UserSessionEntity';

class UserSessionEntityFixture {
  value = {} as IUserSessionEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = new UserSessionEntity({ ...this.value });
    this.withDefault();
    return temp;
  }

  withDefault() {
    this.value = {
      lastUsedAt: new Date(),
      tokenHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
      userId: faker.string.uuid(),
    };
    return this;
  }

  // Builder methods

  withDeviceName(deviceName: string) {
    this.value.deviceName = deviceName;
    return this;
  }

  withLastUsedAt(lastUsedAt: Date) {
    this.value.lastUsedAt = lastUsedAt;
    return this;
  }

  withPreviousTokenHash(previousTokenHash: string) {
    this.value.previousTokenHash = previousTokenHash;
    return this;
  }

  withRetiredTokenHash(retiredTokenHash: string) {
    this.value.retiredTokenHash = retiredTokenHash;
    return this;
  }

  withTokenHash(tokenHash: string) {
    this.value.tokenHash = tokenHash;
    return this;
  }

  withUserId(userId: string) {
    this.value.userId = userId;
    return this;
  }
}

export default UserSessionEntityFixture;
