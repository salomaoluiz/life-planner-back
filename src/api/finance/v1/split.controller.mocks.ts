import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceEtagGuard } from '@api/finance/v1/finance-etag';
import { SplitController } from '@api/finance/v1/split.controller';
import { SplitService } from '@api/finance/v1/split.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const requestMock = { user: { id: userId } } as JwtPayload & Request;
const responseMock = { item: { id: faker.string.uuid() }, lookups: {} };
const body = {
  accountId: faker.string.uuid(),
  date: '2026-11-15',
  description: 'Mercado',
  parts: [
    { categoryId: faker.string.uuid(), type: 'EXPENSE', value: 12000 },
    { systemKey: 'SPLIT_ADJUSTMENT', type: 'EXPENSE', value: -440 },
  ],
};

const splitServiceMock = {
  create: jest.fn().mockResolvedValue(responseMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(responseMock),
  update: jest.fn().mockResolvedValue(responseMock),
};

// endregion Mocks

let setup: SplitController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [SplitController],
    providers: [{ provide: SplitService, useValue: splitServiceMock }],
  })
    .overrideGuard(FinanceEtagGuard)
    .useValue({ canActivate: () => true })
    .compile();

  setup = module.get(SplitController);
});

const mocks = {
  body,
  request: requestMock,
  response: responseMock,
  splitService: splitServiceMock,
};
const spies = {};

export { mocks, setup, spies };
