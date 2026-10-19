import { faker } from '@faker-js/faker';

import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class RecurrenceEntityFixture {
  value = {} as RecurrenceEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withCard(creditCardId: string) {
    this.value.accountId = null;
    this.value.account = null;
    this.value.creditCardId = creditCardId;
    this.value.creditCard = { color: '#112233', id: creditCardId, title: 'Card' };
    return this;
  }

  withDefault() {
    const accountId = faker.string.uuid();
    const categoryId = faker.string.uuid();

    this.value = {
      account: { icon: 'bank', id: accountId, name: faker.finance.accountName() },
      accountId,
      category: {
        excludeFromTotals: false,
        icon: 'home',
        iconColor: '#2E7D32',
        id: categoryId,
        name: faker.commerce.department(),
        systemKey: null,
      },
      categoryId,
      createdAt: faker.date.past(),
      creditCard: null,
      creditCardId: null,
      description: faker.commerce.productName().slice(0, 100),
      endDate: null,
      firstNumber: 1,
      frequency: RecurrenceFrequency.MONTHLY,
      id: faker.string.uuid(),
      lastGeneratedNumber: 1,
      nextOccurrenceDate: '2026-11-05',
      occurrenceCount: null,
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      skippedNumbers: [],
      startDate: '2026-10-05',
      status: RecurrenceStatus.ACTIVE,
      type: TransactionType.EXPENSE,
      updatedAt: faker.date.recent(),
      value: faker.number.int({ max: 100_000, min: 1 }),
    };
    return this;
  }

  withFields(fields: Partial<RecurrenceEntity>) {
    this.value = { ...this.value, ...fields };
    return this;
  }
}

export default RecurrenceEntityFixture;
