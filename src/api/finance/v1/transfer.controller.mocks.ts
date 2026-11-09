import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceEtagGuard } from '@api/finance/v1/finance-etag';
import { TransferController } from '@api/finance/v1/transfer.controller';
import { TransferService } from '@api/finance/v1/transfer.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const responseMock = { item: { id: faker.string.uuid() }, lookups: {}, rows: [] };
const body = {
  amountOut: 100000,
  dateOut: '2026-11-04',
  description: 'Savings',
  fromAccountId: faker.string.uuid(),
  paid: true,
  toAccountId: faker.string.uuid(),
};

const transferServiceMock = {
  create: jest.fn().mockResolvedValue(responseMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(responseMock),
  update: jest.fn().mockResolvedValue(responseMock),
};

// endregion Mocks

let setup: TransferController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [TransferController],
    providers: [{ provide: TransferService, useValue: transferServiceMock }],
  })
    .overrideGuard(FinanceEtagGuard)
    .useValue({ canActivate: () => true })
    .compile();

  setup = module.get(TransferController);
});

const mocks = {
  body,
  request: requestMock,
  response: responseMock,
  transferService: transferServiceMock,
};
const spies = {};

export { mocks, setup, spies };
