import { Test } from '@nestjs/testing';

import { GetInstallmentPlanUseCase } from '@finance/application/use-case/GetInstallmentPlanUseCase';
import { GetPrepaymentPreviewUseCase } from '@finance/application/use-case/GetPrepaymentPreviewUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { PrepayInstallmentPlanUseCase } from './index';

// region Mocks

const planMock = new InstallmentPlanEntityFixture().build();
const cardMock = new CreditCardEntityFixture()
  .withId(planMock.creditCardId)
  .withOwnerId(planMock.ownerId)
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: planMock.ownerId }],
  date: '2026-10-16',
  discount: 120,
  id: planMock.id,
  targetInvoiceMonth: '2026-10',
  today: '2026-10-16',
};
const detailsMock = { installments: [], plan: planMock };
const getPlanMock = { execute: jest.fn() };
const previewMock = { execute: jest.fn() };
const prepaymentRepositoryMock = { prepay: jest.fn() };

// endregion Mocks

let setup: PrepayInstallmentPlanUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  getPlanMock.execute.mockResolvedValue(detailsMock);
  previewMock.execute.mockResolvedValue({
    card: cardMock,
    eligible: [],
    plan: planMock,
    total: 6666,
  });
  prepaymentRepositoryMock.prepay.mockResolvedValue({ id: 'prepayment-1' });

  const module = await Test.createTestingModule({
    providers: [
      PrepayInstallmentPlanUseCase,
      { provide: GetInstallmentPlanUseCase, useValue: getPlanMock },
      { provide: GetPrepaymentPreviewUseCase, useValue: previewMock },
      { provide: 'IFinancePrepaymentRepository', useValue: prepaymentRepositoryMock },
    ],
  }).compile();

  setup = module.get(PrepayInstallmentPlanUseCase);
});

const mocks = {
  card: cardMock,
  details: detailsMock,
  input: inputMock,
  plan: planMock,
  prepaymentRepository: prepaymentRepositoryMock,
  preview: previewMock,
};
const spies = {};

export { mocks, setup, spies };
