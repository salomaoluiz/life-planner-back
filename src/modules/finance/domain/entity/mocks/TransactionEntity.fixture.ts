import { faker } from '@faker-js/faker';

import TransactionEntity, { TransactionType } from '@finance/domain/entity/TransactionEntity';

class TransactionEntityFixture {
  value = {} as TransactionEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return { ...temp };
  }

  withDefault() {
    this.value = {
      category: faker.commerce.product(),
      date: faker.date.soon({ days: 10 }).toISOString(),
      description: faker.commerce.productDescription(),
      id: faker.string.uuid(),
      ownerId: faker.string.uuid(),
      type: faker.helpers.arrayElement([TransactionType.EXPENSE, TransactionType.INCOME]),
      value: faker.finance.amount({ dec: 2, max: 1000, min: 10 }),
    };

    return this;
  }

  // Builder methods

  withCategory(category: string) {
    this.value.category = category;

    return this;
  }

  withDate(date: Date) {
    this.value.date = date.toISOString();

    return this;
  }

  withDescription(description: string) {
    this.value.description = description;

    return this;
  }

  withId(id: string) {
    this.value.id = id;

    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;

    return this;
  }

  withType(type: TransactionType) {
    this.value.type = type;

    return this;
  }

  withValue(value: string) {
    this.value.value = value;

    return this;
  }
}

export default TransactionEntityFixture;
