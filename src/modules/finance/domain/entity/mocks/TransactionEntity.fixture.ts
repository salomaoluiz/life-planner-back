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
    this.value.account = { icon: 'bank', name: 'Account', ...this.value.account, id: accountId };
    this.value.creditCard = null;
    this.value.creditCardId = null;
    this.value.invoiceMonth = null;
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

  withCard(creditCardId: string, invoiceMonth: string) {
    this.value.account = null;
    this.value.accountId = null;
    this.value.creditCard = { color: '#2B3A8C', id: creditCardId, title: 'Card' };
    this.value.creditCardId = creditCardId;
    this.value.invoiceMonth = invoiceMonth;
    return this;
  }

  withCategoryId(categoryId: string) {
    this.value.categoryId = categoryId;
    this.value.category = { ...this.value.category, id: categoryId };
    return this;
  }

  withCredit(key: SystemCategoryKey, creditCardId: string, invoiceMonth: string) {
    const categoryId = SYSTEM_CATEGORY_IDS[key];

    this.withCard(creditCardId, invoiceMonth);
    this.value.type = TransactionType.INCOME;
    this.value.categoryId = categoryId;
    this.value.category = {
      excludeFromTotals: false,
      icon: 'cash',
      iconColor: '#4CAF50',
      id: categoryId,
      name: key,
      systemKey: key,
    };
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
      creditCard: null,
      creditCardId: null,
      date: '2026-10-03',
      description: faker.commerce.productDescription().slice(0, 100),
      earlyPayment: null,
      id: faker.string.uuid(),
      installmentCount: null,
      installmentNumber: null,
      installmentPlanId: null,
      invoiceMonth: null,
      owner: OwnerType.USER,
      ownerId: faker.string.uuid(),
      paid: true,
      paidFromAccountId: null,
      paidFromAccountName: null,
      paidFromTransactionId: null,
      paymentMethod: null,
      prepaymentId: null,
      refundedName: null,
      refundedPlanId: null,
      refundedTransactionId: null,
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

  withInstallment(planId: string, installmentNumber: number, installmentCount: number) {
    this.value.installmentCount = installmentCount;
    this.value.installmentNumber = installmentNumber;
    this.value.installmentPlanId = planId;
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

  withPaid(paid: boolean) {
    this.value.paid = paid;
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
