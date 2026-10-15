import { faker } from '@faker-js/faker';

import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class TransactionEntityFixture {
  value = {} as TransactionEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withAccountId(accountId: string) {
    this.value.accountId = accountId;
    this.value.account = { ...this.value.account, id: accountId };
    return this;
  }

  withBalanceAdjustment() {
    const categoryId = SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT];

    this.value.categoryId = categoryId;
    this.value.category = {
      excludeFromTotals: true,
      icon: 'scale-balance',
      iconColor: '#607D8B',
      id: categoryId,
      name: 'Balance adjustment',
      systemKey: SystemCategoryKey.BALANCE_ADJUSTMENT,
    };
    return this;
  }

  withCategoryId(categoryId: string) {
    this.value.categoryId = categoryId;
    this.value.category = { ...this.value.category, id: categoryId };
    return this;
  }

  withDate(date: string) {
    this.value.date = date;
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
        icon: 'cart',
        iconColor: '#2E7D32',
        id: categoryId,
        name: faker.commerce.department(),
        systemKey: null,
      },
      categoryId,
      createdAt: faker.date.past(),
      date: '2026-10-03',
      description: faker.commerce.productDescription().slice(0, 100),
      id: faker.string.uuid(),
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      type: TransactionType.EXPENSE,
      updatedAt: faker.date.recent(),
      value: faker.number.int({ max: 100_000, min: 1 }),
    };
    return this;
  }

  withId(id: string) {
    this.value.id = id;
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

  withType(type: TransactionType) {
    this.value.type = type;
    return this;
  }

  withValue(value: number) {
    this.value.value = value;
    return this;
  }
}

export default TransactionEntityFixture;
