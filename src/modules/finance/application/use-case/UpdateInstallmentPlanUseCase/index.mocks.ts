import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetInstallmentPlanUseCase } from '@finance/application/use-case/GetInstallmentPlanUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateInstallmentPlanUseCase } from './index';

// region Mocks

const planMock = new InstallmentPlanEntityFixture().build();
const cardMock = new CreditCardEntityFixture()
  .withId(planMock.creditCardId)
  .withLimit(50_000)
  .withOwnerId(planMock.ownerId)
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: planMock.ownerId }],
  id: planMock.id,
  today: '2026-10-25',
};
const computeMock = { execute: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn() };
const getPlanMock = { execute: jest.fn() };
const planRepositoryMock = {
  findPlanById: jest.fn(),
  recreatePlan: jest.fn(),
  updatePlanText: jest.fn(),
};

// endregion Mocks

let setup: UpdateInstallmentPlanUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([{ invoices: { used: 10000 } }]);
  ensureConsistencyMock.execute.mockResolvedValue({ card: cardMock });
  getPlanMock.execute.mockResolvedValue({ installments: [], plan: { id: planMock.id } });
  planRepositoryMock.findPlanById.mockResolvedValue(planMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateInstallmentPlanUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: GetInstallmentPlanUseCase, useValue: getPlanMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateInstallmentPlanUseCase);
});

const mocks = {
  card: cardMock,
  ensureConsistency: ensureConsistencyMock,
  input: inputMock,
  plan: planMock,
  planRepository: planRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
