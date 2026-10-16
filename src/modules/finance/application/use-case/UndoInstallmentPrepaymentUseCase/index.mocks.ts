import { Test } from '@nestjs/testing';

import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UndoInstallmentPrepaymentUseCase } from './index';

// region Mocks

const planMock = new InstallmentPlanEntityFixture().build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: planMock.ownerId }],
  id: planMock.id,
};
const planRepositoryMock = { findPlanById: jest.fn() };
const prepaymentRepositoryMock = { undoPrepayment: jest.fn() };

// endregion Mocks

let setup: UndoInstallmentPrepaymentUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  planRepositoryMock.findPlanById.mockResolvedValue(planMock);
  prepaymentRepositoryMock.undoPrepayment.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      UndoInstallmentPrepaymentUseCase,
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
      { provide: 'IFinancePrepaymentRepository', useValue: prepaymentRepositoryMock },
    ],
  }).compile();

  setup = module.get(UndoInstallmentPrepaymentUseCase);
});

const mocks = {
  input: inputMock,
  planRepository: planRepositoryMock,
  prepaymentRepository: prepaymentRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
