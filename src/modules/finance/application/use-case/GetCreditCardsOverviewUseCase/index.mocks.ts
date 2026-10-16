import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { calculateInvoices } from '@finance/domain/service/InvoiceCalculator';
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

// Stands in for the real sums: the calculator runs for real over the totals below.
const totalsMock = [{ amount: 4000, invoiceMonth: '2026-11' }];
const computeMock = {
  execute: jest.fn(),
};

// endregion Mocks

let setup: GetCreditCardsOverviewUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockImplementation(
    async ({ cards, today }: { cards: (typeof zetaMock)[]; today: string }) =>
      cards.map((card) => ({
        card,
        invoices: calculateInvoices(card, totalsMock, [], today),
        payments: [],
        totals: totalsMock,
      })),
  );

  const module = await Test.createTestingModule({
    providers: [
      GetCreditCardsOverviewUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetCreditCardsOverviewUseCase);
});

const mocks = {
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  familyCard: familyMock,
  input: inputMock,
  personalCard: personalMock,
};
const spies = {};

export { mocks, setup, spies };
