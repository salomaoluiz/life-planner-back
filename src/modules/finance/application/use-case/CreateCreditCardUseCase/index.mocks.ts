import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { CreditCardBrand } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateCreditCardUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().build();
const accountMock = new AccountEntityFixture()
  .withOwner(OwnerType.USER)
  .withOwnerId(cardMock.ownerId)
  .build();
const updatedMock = new CreditCardEntityFixture().withId(cardMock.id).build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  brand: CreditCardBrand.VISA,
  closingDay: 31,
  color: '#3B5BDB',
  dueDay: 10,
  limit: 500000,
  owner: OwnerType.USER,
  ownerId: cardMock.ownerId,
  title: 'Main card',
};
const baseMock = { accessibleOwners: inputMock.accessibleOwners, id: cardMock.id };

const accountRepositoryMock = { findAccountsByIds: jest.fn().mockResolvedValue([accountMock]) };
const creditCardRepositoryMock = {
  createCreditCard: jest.fn().mockResolvedValue(cardMock),
  deleteCreditCard: jest.fn().mockResolvedValue(undefined),
  findCreditCardById: jest.fn().mockResolvedValue(cardMock),
  findCreditCards: jest.fn().mockResolvedValue([cardMock]),
  updateCreditCard: jest.fn().mockResolvedValue(updatedMock),
};

// endregion Mocks

let setup: CreateCreditCardUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateCreditCardUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateCreditCardUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  base: baseMock,
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  updated: updatedMock,
};
const spies = {};

export { mocks, setup, spies };
