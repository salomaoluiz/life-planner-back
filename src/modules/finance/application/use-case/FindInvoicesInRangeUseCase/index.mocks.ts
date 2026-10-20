import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { FindInvoicesInRangeUseCase } from './index';

// region Mocks

// closing 31, due 10, payment 5: the 2026-10 invoice is planned for 2026-11-05.
const cardMock = new CreditCardEntityFixture().withTitle('Main').build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  from: '2026-11-01',
  to: '2026-11-30',
  today: '2026-10-15',
};
const totalsMock = [
  { amount: 45000, invoiceMonth: '2026-10' },
  { amount: 0, invoiceMonth: '2026-09' },
];
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCards: jest.fn() };

// endregion Mocks

let setup: FindInvoicesInRangeUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([
    { card: cardMock, invoices: {}, payments: [], totals: totalsMock },
  ]);
  creditCardRepositoryMock.findCreditCards.mockResolvedValue([cardMock]);

  const module = await Test.createTestingModule({
    providers: [
      FindInvoicesInRangeUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
    ],
  }).compile();

  setup = module.get(FindInvoicesInRangeUseCase);
});

const mocks = {
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
};
const spies = {};

export { mocks, setup, spies };
