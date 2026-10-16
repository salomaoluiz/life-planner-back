import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { InvoiceController } from '@api/finance/v1/invoice.controller';
import { InvoiceService } from '@api/finance/v1/invoice.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const invoiceServiceMock = {
  findForList: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({}),
  pay: jest.fn().mockResolvedValue({}),
  undo: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

let setup: InvoiceController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [InvoiceController],
    providers: [{ provide: InvoiceService, useValue: invoiceServiceMock }],
  }).compile();

  setup = module.get(InvoiceController);
});

const mocks = { invoiceService: invoiceServiceMock, request: requestMock, userId };
const spies = {};

export { mocks, setup, spies };
