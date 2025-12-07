import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@db/client';
import { EnvService } from '@shared/infra/env/env.service';

import { Database } from './Database';

// region Mocks

jest.mock('@prisma/adapter-pg');
jest.mock('@db/client');

const envServiceMock = {
  dbHost: 'localhost',
  dbName: 'test_db',
  dbPassword: 'password',
  dbPort: '5432',
  dbUser: 'user',
} as unknown as EnvService;

const prismaPgInstanceMock = {} as PrismaPg;
const prismaClientInstanceMock = {} as PrismaClient;

// endregion Mocks

// region Spies

const prismaPgSpy = jest.mocked(PrismaPg).mockReturnValue(prismaPgInstanceMock);
const prismaClientSpy = jest.mocked(PrismaClient).mockReturnValue(prismaClientInstanceMock);

// endregion Spies

let setup: Database;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      Database,
      {
        provide: EnvService,
        useValue: envServiceMock,
      },
    ],
  }).compile();

  setup = module.get<Database>(Database);
});

const mocks = {
  envService: envServiceMock,
  prismaClientInstance: prismaClientInstanceMock,
  prismaPgInstance: prismaPgInstanceMock,
};

const spies = {
  prismaClient: prismaClientSpy,
  prismaPg: prismaPgSpy,
};

export { mocks, setup, spies };
