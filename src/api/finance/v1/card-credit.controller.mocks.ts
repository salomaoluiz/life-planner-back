import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CardCreditController } from '@api/finance/v1/card-credit.controller';
import { CardCreditService } from '@api/finance/v1/card-credit.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const serviceMock = {
  createEarlyPayment: jest.fn(),
  createRefund: jest.fn(),
  deleteEarlyPayment: jest.fn(),
  deleteRefund: jest.fn(),
  updateEarlyPayment: jest.fn(),
  updateRefund: jest.fn(),
};

// endregion Mocks

let setup: CardCreditController;

beforeEach(async () => {
  jest.clearAllMocks();
  Object.values(serviceMock).forEach((fn) => fn.mockResolvedValue({ id: 'x' }));

  const module = await Test.createTestingModule({
    controllers: [CardCreditController],
    providers: [{ provide: CardCreditService, useValue: serviceMock }],
  }).compile();

  setup = module.get(CardCreditController);
});

const mocks = { request: requestMock, service: serviceMock };
const spies = {};

export { mocks, setup, spies };
