import { faker } from '@faker-js/faker';

import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

class InstallmentPlanEntityFixture {
  value = {} as InstallmentPlanEntity;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withDefault() {
    const id = faker.string.uuid();
    const creditCardId = faker.string.uuid();
    const ownerId = faker.string.uuid();

    this.value = {
      categoryId: faker.string.uuid(),
      createdAt: faker.date.past(),
      creditCardId,
      currency: 'BRL' as const,
      date: '2026-10-20',
      description: 'Notebook',
      id,
      installmentCount: 3,
      installments: [
        [3334, '2026-10'],
        [3333, '2026-11'],
        [3333, '2026-12'],
      ].map(([value, month], index) => ({
        ...new TransactionEntityFixture()
          .withCard(creditCardId, month as string)
          .withInstallment(id, index + 1, 3)
          .withOwnerId(ownerId)
          .withValue(value as number)
          .build(),
      })),
      owner: OwnerType.USER,
      ownerId,
      prepayment: null,
      totalValue: 10000,
      updatedAt: faker.date.recent(),
    };
    return this;
  }

  withOwnerId(ownerId: string) {
    this.value.ownerId = ownerId;
    this.value.installments.forEach((row) => {
      row.ownerId = ownerId;
    });
    return this;
  }
}

export default InstallmentPlanEntityFixture;
