import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FamilyController } from '@api/family/v1/family.controller';
import { FamilyService } from '@api/family/v1/family.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const familyApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  id: faker.string.uuid(),
  name: 'Example Family',
  ownerId: userId,
  updatedAt: '2026-10-04T12:00:00.000Z',
};

const requestMock = { user: { id: userId } } as JwtPayload & Request;

const familyServiceMock = {
  create: jest.fn().mockResolvedValue(familyApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([familyApiMock]),
  findById: jest.fn().mockResolvedValue(familyApiMock),
  update: jest.fn().mockResolvedValue(familyApiMock),
};

// endregion Mocks

let setup: FamilyController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [FamilyController],
    providers: [{ provide: FamilyService, useValue: familyServiceMock }],
  }).compile();

  setup = module.get<FamilyController>(FamilyController);
});

const mocks = { family: familyApiMock, familyService: familyServiceMock, request: requestMock };
const spies = {};

export { mocks, setup, spies };
