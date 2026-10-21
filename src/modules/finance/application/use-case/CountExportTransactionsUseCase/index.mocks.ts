import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CountExportTransactionsUseCase } from './index';

// region Mocks

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { archived: true, owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const transactionRepositoryMock = {
  countTransactionsForExport: jest.fn().mockResolvedValue(7),
};

// endregion Mocks

let setup: CountExportTransactionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionRepositoryMock.countTransactionsForExport.mockResolvedValue(7);

  const module = await Test.createTestingModule({
    providers: [
      CountExportTransactionsUseCase,
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(CountExportTransactionsUseCase);
});

const mocks = { accessibleOwners, transactionRepository: transactionRepositoryMock };

export { mocks, setup };
