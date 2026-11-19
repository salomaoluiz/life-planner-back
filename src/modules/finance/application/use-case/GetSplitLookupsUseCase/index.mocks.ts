import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetSplitLookupsUseCase } from './index';

// region Mocks

const summary = {
  description: 'Mercado',
  id: 'split-1',
  notes: null,
  occurrenceNumber: null,
  owner: OwnerType.USER,
  ownerId: 'user-1',
  paid: true,
  partCount: 3,
  recurrenceId: null,
  total: 28000,
  type: 'EXPENSE',
};
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];

// endregion Mocks

const splitRepositoryMock = { findSplitSummaries: jest.fn() };

let setup: GetSplitLookupsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  splitRepositoryMock.findSplitSummaries.mockResolvedValue([
    summary,
    { ...summary, id: 'split-2', ownerId: 'stranger' },
  ]);

  const module = await Test.createTestingModule({
    providers: [
      GetSplitLookupsUseCase,
      { provide: 'IFinanceSplitRepository', useValue: splitRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetSplitLookupsUseCase);
});

const mocks = { accessibleOwners, summary };
const spies = { splitRepository: splitRepositoryMock };

export { mocks, setup, spies };
