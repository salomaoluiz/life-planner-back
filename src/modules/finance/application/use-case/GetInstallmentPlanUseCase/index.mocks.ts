import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetInstallmentPlanUseCase } from './index';

// region Mocks

const planMock = new InstallmentPlanEntityFixture().build();
const cardMock = new CreditCardEntityFixture()
  .withId(planMock.creditCardId)
  .withOwnerId(planMock.ownerId)
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: planMock.ownerId }],
  id: planMock.id,
  today: '2026-10-25',
};
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const planRepositoryMock = { findPlanById: jest.fn() };

// endregion Mocks

let setup: GetInstallmentPlanUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([
    {
      payments: [
        {
          accountId: null,
          accountName: null,
          amount: 3334,
          method: 'EXTERNAL',
          paidOn: '2026-11-05',
          referenceMonth: '2026-10',
        },
      ],
      totals: [
        { amount: 3334, invoiceMonth: '2026-10' },
        { amount: 3333, invoiceMonth: '2026-11' },
        { amount: 3333, invoiceMonth: '2026-12' },
      ],
    },
  ]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  planRepositoryMock.findPlanById.mockResolvedValue({ ...planMock, totalValue: 1 });

  const module = await Test.createTestingModule({
    providers: [
      GetInstallmentPlanUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetInstallmentPlanUseCase);
});

const mocks = {
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  plan: planMock,
  planRepository: planRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
