import { Test } from '@nestjs/testing';

import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteInstallmentPlanUseCase } from './index';

// region Mocks

const planMock = new InstallmentPlanEntityFixture().build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: planMock.ownerId }],
  id: planMock.id,
};
const cardCreditRepositoryMock = { countRefundsByPlanId: jest.fn() };
const planRepositoryMock = { deletePlan: jest.fn(), findPlanById: jest.fn() };

// endregion Mocks

let setup: DeleteInstallmentPlanUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.countRefundsByPlanId.mockResolvedValue(0);
  planRepositoryMock.deletePlan.mockResolvedValue(undefined);
  planRepositoryMock.findPlanById.mockResolvedValue(planMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteInstallmentPlanUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteInstallmentPlanUseCase);
});

const mocks = {
  cardCreditRepository: cardCreditRepositoryMock,
  input: inputMock,
  planRepository: planRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
