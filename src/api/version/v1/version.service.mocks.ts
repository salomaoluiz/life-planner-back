import { Test } from '@nestjs/testing';

import { mocks as dtoMocks } from '@api/version/v1/dto/version.dto.mocks';
import { VersionService } from '@api/version/v1/version.service';
import { GetVersionInfoUseCase } from '@version/application/use-case/GetVersionInfoUseCase';

const getVersionInfoMock = { execute: jest.fn().mockResolvedValue(dtoMocks.versionOutput) };

let setup: VersionService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [VersionService, { provide: GetVersionInfoUseCase, useValue: getVersionInfoMock }],
  }).compile();

  setup = module.get(VersionService);
});

const mocks = { getVersionInfo: getVersionInfoMock, output: dtoMocks.versionOutput };

export { mocks, setup };
