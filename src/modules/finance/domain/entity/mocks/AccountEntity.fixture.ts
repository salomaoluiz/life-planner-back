import { faker } from '@faker-js/faker';

import AccountEntity from '@finance/domain/entity/AccountEntity';
import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class AccountEntityFixture {
  value = {} as AccountEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withBalance(balance: number) {
    this.value.balance = balance;
    return this;
  }

  withDefault() {
    this.value = {
      balance: faker.number.int({ max: 1_000_000, min: -100_000 }),
      createdAt: faker.date.past(),
      icon: 'bank',
      id: faker.string.uuid(),
      name: faker.finance.accountName(),
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      status: AccountStatus.ACTIVE,
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

  withOwner(owner: OwnerType) {
    this.value.owner = owner;
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    return this;
  }

  withStatus(status: AccountStatus) {
    this.value.status = status;
    return this;
  }
}

export default AccountEntityFixture;
