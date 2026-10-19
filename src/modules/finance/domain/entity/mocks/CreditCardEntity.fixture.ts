import { faker } from '@faker-js/faker';

import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { AccountStatus, CreditCardBrand } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class CreditCardEntityFixture {
  value = {} as CreditCardEntity;

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
      brand: CreditCardBrand.VISA,
      closingDay: 31,
      color: '#3B5BDB',
      createdAt: faker.date.past(),
      dueDay: 10,
      id: faker.string.uuid(),
      lastDigits: '1234',
      limit: faker.number.int({ max: 1_000_000, min: 1000 }),
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      paymentDay: 5,
      status: AccountStatus.ACTIVE,
      title: faker.finance.accountName(),
      updatedAt: faker.date.recent(),
    };
    return this;
  }

  withId(id: string) {
    this.value.id = id;
    return this;
  }

  withLimit(limit: number) {
    this.value.limit = limit;
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

  withPaymentAccountId(paymentAccountId?: string) {
    this.value.paymentAccountId = paymentAccountId;
    return this;
  }

  withStatus(status: AccountStatus) {
    this.value.status = status;
    return this;
  }

  withTitle(title: string) {
    this.value.title = title;
    return this;
  }
}

export default CreditCardEntityFixture;
