import { Test } from '@nestjs/testing';

import { mocks as dtoMocks } from '@api/version/v1/dto/version.dto.mocks';
import { VersionController } from '@api/version/v1/version.controller';
import { VersionService } from '@api/version/v1/version.service';

const versionServiceMock = { get: jest.fn().mockResolvedValue(dtoMocks.versionOutput) };

let setup: VersionController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [VersionController],
    providers: [{ provide: VersionService, useValue: versionServiceMock }],
  }).compile();

  setup = module.get(VersionController);
});

const mocks = { output: dtoMocks.versionOutput, versionService: versionServiceMock };

export { mocks, setup };
