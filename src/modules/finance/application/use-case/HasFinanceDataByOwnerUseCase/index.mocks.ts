import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { HasFinanceDataByOwnerUseCase } from './index';

// region Mocks

const inputMock = { owner: OwnerType.FAMILY, ownerId: 'family-id' };

const accountRepositoryMock = { existsByOwner: jest.fn() };
const categoryRepositoryMock = { existsByOwner: jest.fn() };
const creditCardRepositoryMock = { existsByOwner: jest.fn() };
const invoicePaymentRepositoryMock = { existsByOwner: jest.fn() };
const recurrenceRepositoryMock = { existsByOwner: jest.fn() };
const transactionRepositoryMock = { existsByOwner: jest.fn() };

// endregion Mocks

let setup: HasFinanceDataByOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.existsByOwner.mockResolvedValue(false);
  categoryRepositoryMock.existsByOwner.mockResolvedValue(false);
  creditCardRepositoryMock.existsByOwner.mockResolvedValue(false);
  invoicePaymentRepositoryMock.existsByOwner.mockResolvedValue(false);
  recurrenceRepositoryMock.existsByOwner.mockResolvedValue(false);
  transactionRepositoryMock.existsByOwner.mockResolvedValue(false);

  const module = await Test.createTestingModule({
    providers: [
      HasFinanceDataByOwnerUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInvoicePaymentRepository', useValue: invoicePaymentRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(HasFinanceDataByOwnerUseCase);
});

const mocks = {
  accountRepository: accountRepositoryMock,
  categoryRepository: categoryRepositoryMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  invoicePaymentRepository: invoicePaymentRepositoryMock,
  recurrenceRepository: recurrenceRepositoryMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
