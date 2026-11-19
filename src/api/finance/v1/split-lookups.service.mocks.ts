import { Test } from '@nestjs/testing';

import { SplitLookupsService } from '@api/finance/v1/split-lookups.service';
import { GetSplitLookupsUseCase } from '@finance/application/use-case/GetSplitLookupsUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

function part(id: string, splitId: null | string, value: number) {
  return Object.assign(
    new TransactionEntityFixture()
      .withDefault()
      .withType(TransactionType.EXPENSE)
      .withValue(value)
      .build(),
    { id, splitId },
  );
}
const rows = [part('p1', 'split-1', 5000), part('p2', null, 1), part('p3', 'split-1', 700)];
const summary = {
  description: 'Mercado',
  id: 'split-1',
  notes: 'Compra',
  occurrenceNumber: 2,
  owner: OwnerType.USER,
  ownerId: 'user-1',
  paid: true,
  partCount: 6,
  recurrenceId: 'rec-1',
  total: 28000,
  type: TransactionType.EXPENSE,
};
const lookups = { accounts: {}, categories: {}, creditCards: {}, tags: {} };
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];

// endregion Mocks

const getSplitLookupsUseCaseMock = { execute: jest.fn() };

let setup: SplitLookupsService;

beforeEach(async () => {
  jest.clearAllMocks();
  getSplitLookupsUseCaseMock.execute.mockResolvedValue([summary]);

  const module = await Test.createTestingModule({
    providers: [
      SplitLookupsService,
      { provide: GetSplitLookupsUseCase, useValue: getSplitLookupsUseCaseMock },
    ],
  }).compile();

  setup = module.get(SplitLookupsService);
});

const mocks = { accessibleOwners, lookups, rows, summary };
const spies = { getSplitLookupsUseCase: getSplitLookupsUseCaseMock };

export { mocks, setup, spies };
