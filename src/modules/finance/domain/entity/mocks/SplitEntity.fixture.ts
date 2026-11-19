import { faker } from '@faker-js/faker';

import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Two expense parts (12000 and 5000) on an account, paid; override what a test needs.
class SplitEntityFixture {
  private split: SplitEntity;

  constructor() {
    const ownerId = faker.string.uuid();
    const id = faker.string.uuid();
    const parts = [12000, 5000].map((value, index) => {
      const part = new TransactionEntityFixture()
        .withDefault()
        .withOwnerId(ownerId)
        .withType(TransactionType.EXPENSE)
        .withValue(value)
        .build();

      return Object.assign(part, { id: `part-${index + 1}`, splitId: id });
    });

    this.split = new SplitEntity({
      accountId: parts[0].accountId,
      createdAt: new Date('2026-11-15T10:00:00.000Z'),
      createdBy: ownerId,
      creditCardId: null,
      currency: parts[0].currency,
      date: '2026-11-15',
      description: 'Mercado',
      id,
      invoiceMonth: null,
      notes: null,
      occurrenceNumber: null,
      owner: OwnerType.USER,
      ownerId,
      paid: true,
      parts,
      recurrenceId: null,
      updatedAt: new Date('2026-11-15T10:00:00.000Z'),
    });
  }

  build(): SplitEntity {
    return this.split;
  }

  withParts(parts: TransactionEntity[]) {
    this.split = new SplitEntity({ ...this.split, parts });

    return this;
  }
}

export default SplitEntityFixture;
