import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetInstallmentPlanUseCase } from '@finance/application/use-case/GetInstallmentPlanUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateInstallmentPlanUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().withLimit(500_000).build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  categoryId: 'category-1',
  creditCardId: cardMock.id,
  date: '2026-10-20',
  description: 'Notebook',
  installments: 10,
  owner: OwnerType.USER,
  ownerId: cardMock.ownerId,
  today: '2026-10-25',
  value: 512000,
};
const computeMock = { execute: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn() };
const getPlanMock = { execute: jest.fn() };
const planRepositoryMock = { createPlan: jest.fn() };

// endregion Mocks

let setup: CreateInstallmentPlanUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([{ invoices: { used: 512000 } }]);
  ensureConsistencyMock.execute.mockResolvedValue({ card: cardMock });
  getPlanMock.execute.mockResolvedValue({ installments: [], plan: { id: 'plan-1' } });
  planRepositoryMock.createPlan.mockResolvedValue('plan-1');

  const module = await Test.createTestingModule({
    providers: [
      CreateInstallmentPlanUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: GetInstallmentPlanUseCase, useValue: getPlanMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateInstallmentPlanUseCase);
});

const mocks = {
  card: cardMock,
  compute: computeMock,
  ensureConsistency: ensureConsistencyMock,
  getPlan: getPlanMock,
  input: inputMock,
  planRepository: planRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
