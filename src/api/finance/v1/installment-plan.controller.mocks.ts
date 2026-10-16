import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { InstallmentPlanController } from '@api/finance/v1/installment-plan.controller';
import { InstallmentPlanService } from '@api/finance/v1/installment-plan.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const outputMock = { installments: [], plan: { id: faker.string.uuid() } };
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const serviceMock = {
  create: jest.fn(),
  delete: jest.fn(),
  findOne: jest.fn(),
  prepay: jest.fn(),
  prepaymentPreview: jest.fn(),
  undoPrepayment: jest.fn(),
  update: jest.fn(),
};

// endregion Mocks

let setup: InstallmentPlanController;

beforeEach(async () => {
  jest.clearAllMocks();
  serviceMock.create.mockResolvedValue(outputMock);
  serviceMock.delete.mockResolvedValue(undefined);
  serviceMock.findOne.mockResolvedValue(outputMock);
  serviceMock.prepay.mockResolvedValue(outputMock);
  serviceMock.prepaymentPreview.mockResolvedValue({ eligible: [], total: 0 });
  serviceMock.undoPrepayment.mockResolvedValue(undefined);
  serviceMock.update.mockResolvedValue(outputMock);

  const module = await Test.createTestingModule({
    controllers: [InstallmentPlanController],
    providers: [{ provide: InstallmentPlanService, useValue: serviceMock }],
  }).compile();

  setup = module.get(InstallmentPlanController);
});

const mocks = { output: outputMock, request: requestMock, service: serviceMock };
const spies = {};

export { mocks, setup, spies };
