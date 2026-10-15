import { Test } from '@nestjs/testing';

import { FinanceOwnerDataRepository } from './index';

// region Mocks

const ownerDataDatasourceMock = { deleteAllByOwner: jest.fn() };

// endregion Mocks

let setup: FinanceOwnerDataRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  ownerDataDatasourceMock.deleteAllByOwner.mockResolvedValue(7);

  const module = await Test.createTestingModule({
    providers: [
      FinanceOwnerDataRepository,
      { provide: 'IFinanceOwnerDataDatasource', useValue: ownerDataDatasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceOwnerDataRepository);
});

const mocks = { ownerDataDatasource: ownerDataDatasourceMock };
const spies = {};

export { mocks, setup, spies };
