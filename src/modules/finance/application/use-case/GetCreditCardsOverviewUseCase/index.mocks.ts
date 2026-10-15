import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetCreditCardsOverviewUseCase } from './index';

// region Mocks

const createdAt = new Date('2026-10-14T12:00:00.000Z');
const zetaMock = new CreditCardEntityFixture()
  .withTitle('Zeta')
  .withLimit(300000)
  .withCreatedAt(createdAt)
  .build();
const alphaMock = new CreditCardEntityFixture()
  .withTitle('alpha')
  .withLimit(500000)
  .withOwnerId(zetaMock.ownerId)
  .withCreatedAt(createdAt)
  .build();
const personalMock = new CreditCardEntityFixture().withOwnerId('user-a').build();
const familyMock = new CreditCardEntityFixture()
  .withOwner(OwnerType.FAMILY)
  .withOwnerId('family-f')
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: zetaMock.ownerId }],
  today: '2026-10-15',
};

const creditCardRepositoryMock = {
  findCreditCards: jest.fn().mockResolvedValue([zetaMock, alphaMock]),
};

// endregion Mocks

let setup: GetCreditCardsOverviewUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetCreditCardsOverviewUseCase,
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetCreditCardsOverviewUseCase);
});

const mocks = {
  creditCardRepository: creditCardRepositoryMock,
  familyCard: familyMock,
  input: inputMock,
  personalCard: personalMock,
};
const spies = {};

export { mocks, setup, spies };
