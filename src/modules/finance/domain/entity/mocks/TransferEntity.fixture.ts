import { faker } from '@faker-js/faker';

import TransferEntity from '@finance/domain/entity/TransferEntity';

class TransferEntityFixture {
  value = {} as TransferEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withAccounts(fromAccountId: string, toAccountId: string) {
    this.value.fromAccountId = fromAccountId;
    this.value.toAccountId = toAccountId;
    return this;
  }

  withDefault() {
    this.value = {
      amountIn: 100000,
      amountOut: 100000,
      createdAt: faker.date.past(),
      createdBy: faker.string.uuid(),
      currencyIn: 'BRL',
      currencyOut: 'BRL',
      dateIn: '2026-11-04',
      dateOut: '2026-11-04',
      description: faker.lorem.words(2),
      fee: null,
      fromAccountId: faker.string.uuid(),
      id: faker.string.uuid(),
      notes: null,
      occurrenceNumber: null,
      paid: true,
      recurrenceId: null,
      rowIds: [faker.string.uuid(), faker.string.uuid()],
      toAccountId: faker.string.uuid(),
      updatedAt: faker.date.recent(),
    };
    return this;
  }
}

export default TransferEntityFixture;
