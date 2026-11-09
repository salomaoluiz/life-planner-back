import { Test } from '@nestjs/testing';

import { TransferLookupsService } from '@api/finance/v1/transfer-lookups.service';
import { GetTransferLookupsUseCase } from '@finance/application/use-case/GetTransferLookupsUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';

// region Mocks

const counterpart = new AccountEntityFixture().withId('acc-to').build();
const plainRow = new TransactionEntityFixture().build();
const transferRow = { ...new TransactionEntityFixture().build(), transferId: 'transfer-1' };
const baseLookups = {
  accounts: { 'acc-from': { icon: 'bank', name: 'Checking' } },
  categories: {},
  creditCards: {},
  tags: {},
};
const transferLookup = {
  amountIn: 92000,
  amountOut: 500000,
  counterpartHidden: false,
  currencyIn: 'USD',
  currencyOut: 'BRL',
  dateIn: '2026-11-06',
  dateOut: '2026-11-04',
  feeRowId: 'row-fee',
  fromAccountId: 'acc-from',
  id: 'transfer-1',
  recurrenceId: null,
  toAccountId: 'acc-to',
};

// endregion Mocks

const getTransferLookupsUseCaseMock = {
  execute: jest.fn().mockResolvedValue({ accounts: [counterpart], transfers: [transferLookup] }),
};

let setup: TransferLookupsService;

beforeEach(async () => {
  jest.clearAllMocks();
  getTransferLookupsUseCaseMock.execute.mockResolvedValue({
    accounts: [counterpart],
    transfers: [transferLookup],
  });

  const module = await Test.createTestingModule({
    providers: [
      TransferLookupsService,
      { provide: GetTransferLookupsUseCase, useValue: getTransferLookupsUseCaseMock },
    ],
  }).compile();

  setup = module.get(TransferLookupsService);
});

const mocks = { baseLookups, counterpart, plainRow, transferLookup, transferRow };
const spies = { getTransferLookups: getTransferLookupsUseCaseMock };

export { mocks, setup, spies };
