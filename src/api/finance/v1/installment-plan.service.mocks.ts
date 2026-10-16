import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { InstallmentPlanService } from '@api/finance/v1/installment-plan.service';
import { CreateInstallmentPlanUseCase } from '@finance/application/use-case/CreateInstallmentPlanUseCase';
import { DeleteInstallmentPlanUseCase } from '@finance/application/use-case/DeleteInstallmentPlanUseCase';
import { GetInstallmentPlanUseCase } from '@finance/application/use-case/GetInstallmentPlanUseCase';
import { UpdateInstallmentPlanUseCase } from '@finance/application/use-case/UpdateInstallmentPlanUseCase';
import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { InvoiceStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const plan = new InstallmentPlanEntityFixture().build();
const detailsMock = {
  installments: [
    {
      id: plan.installments[0].id,
      installmentNumber: 1,
      invoiceMonth: '2026-10',
      invoiceStatus: InvoiceStatus.OPEN,
      value: 3334,
    },
  ],
  overLimit: false,
  plan,
};
const createUseCaseMock = { execute: jest.fn() };
const deleteUseCaseMock = { execute: jest.fn() };
const financeAccessServiceMock = { resolve: jest.fn() };
const getUseCaseMock = { execute: jest.fn() };
const updateUseCaseMock = { execute: jest.fn() };

// endregion Mocks

let setup: InstallmentPlanService;

beforeEach(async () => {
  jest.clearAllMocks();
  createUseCaseMock.execute.mockResolvedValue(detailsMock);
  deleteUseCaseMock.execute.mockResolvedValue(undefined);
  financeAccessServiceMock.resolve.mockResolvedValue(accessibleOwners);
  getUseCaseMock.execute.mockResolvedValue({ ...detailsMock, overLimit: undefined });
  updateUseCaseMock.execute.mockResolvedValue(detailsMock);

  const module = await Test.createTestingModule({
    providers: [
      InstallmentPlanService,
      { provide: CreateInstallmentPlanUseCase, useValue: createUseCaseMock },
      { provide: DeleteInstallmentPlanUseCase, useValue: deleteUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetInstallmentPlanUseCase, useValue: getUseCaseMock },
      { provide: UpdateInstallmentPlanUseCase, useValue: updateUseCaseMock },
    ],
  }).compile();

  setup = module.get(InstallmentPlanService);
});

const mocks = {
  accessibleOwners,
  create: createUseCaseMock,
  delete: deleteUseCaseMock,
  details: detailsMock,
  get: getUseCaseMock,
  plan,
  update: updateUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
