import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetPrepaymentPreviewUseCase } from './index';

// region Mocks

// Plan of 3 installments: 2026-10 (3334), 2026-11 (3333), 2026-12 (3333); the card closes on day 10.
const planMock = new InstallmentPlanEntityFixture().build();
const cardMock = {
  ...new CreditCardEntityFixture()
    .withId(planMock.creditCardId)
    .withOwnerId(planMock.ownerId)
    .build(),
  closingDay: 10,
};
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: planMock.ownerId }],
  id: planMock.id,
  targetInvoiceMonth: '2026-10',
  today: '2026-10-16',
};
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const planRepositoryMock = { findPlanById: jest.fn() };

// endregion Mocks

let setup: GetPrepaymentPreviewUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([{ card: cardMock, payments: [], totals: [] }]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  planRepositoryMock.findPlanById.mockResolvedValue(planMock);

  const module = await Test.createTestingModule({
    providers: [
      GetPrepaymentPreviewUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetPrepaymentPreviewUseCase);
});

const mocks = {
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  plan: planMock,
  planRepository: planRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
