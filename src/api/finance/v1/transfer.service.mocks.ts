import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { TransferLookupsService } from '@api/finance/v1/transfer-lookups.service';
import { TransferService } from '@api/finance/v1/transfer.service';
import { CreateTransferUseCase } from '@finance/application/use-case/CreateTransferUseCase';
import { DeleteTransferUseCase } from '@finance/application/use-case/DeleteTransferUseCase';
import { GetTransactionByIdUseCase } from '@finance/application/use-case/GetTransactionByIdUseCase';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import { UpdateTransferUseCase } from '@finance/application/use-case/UpdateTransferUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import TransferEntityFixture from '@finance/domain/entity/mocks/TransferEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const rowMock = new TransactionEntityFixture().build();
const sameCurrency = new TransferEntityFixture().build();
const crossCurrency = {
  ...new TransferEntityFixture().build(),
  amountIn: 92000,
  amountOut: 500000,
  currencyIn: 'USD',
  fee: 350,
};

const createTransferUseCaseMock = { execute: jest.fn().mockResolvedValue(sameCurrency) };
const deleteTransferUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getTransactionByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(rowMock) };
const getTransferUseCaseMock = { execute: jest.fn().mockResolvedValue(sameCurrency) };
const updateTransferUseCaseMock = { execute: jest.fn().mockResolvedValue(sameCurrency) };

const transferLookupsServiceMock = {
  attach: jest.fn(async (_owners: unknown, _rows: unknown, lookups: unknown) => lookups),
};

// endregion Mocks

let setup: TransferService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      TransferService,
      { provide: CreateTransferUseCase, useValue: createTransferUseCaseMock },
      { provide: DeleteTransferUseCase, useValue: deleteTransferUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetTransactionByIdUseCase, useValue: getTransactionByIdUseCaseMock },
      { provide: GetTransferUseCase, useValue: getTransferUseCaseMock },
      { provide: UpdateTransferUseCase, useValue: updateTransferUseCaseMock },
      { provide: TransferLookupsService, useValue: transferLookupsServiceMock },
    ],
  }).compile();

  setup = module.get(TransferService);
});

const mocks = { accessibleOwners, crossCurrency, row: rowMock, sameCurrency, userId };
const spies = {
  createTransfer: createTransferUseCaseMock,
  deleteTransfer: deleteTransferUseCaseMock,
  getTransaction: getTransactionByIdUseCaseMock,
  getTransfer: getTransferUseCaseMock,
  transferLookupsService: transferLookupsServiceMock,
  updateTransfer: updateTransferUseCaseMock,
};

export { mocks, setup, spies };
