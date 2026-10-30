import { Test } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';
import { LogLevel } from '@shared/infra/logger/types';

import { GetVersionInfoUseCase } from './index';

// region Mocks

function releaseMock(tag: string, body = '### Added\n- thing') {
  return {
    body,
    publishedAt: '2026-10-30T09:00:00Z',
    tagName: tag,
    url: `https://github.com/your-org/your-repo/releases/tag/${tag}`,
  };
}

const githubMock = { listReleases: jest.fn() };
const buildInfoMock = {
  read: jest.fn().mockReturnValue({
    builtAt: '2026-10-27T21:40:00Z',
    releasedAt: '2026-10-27',
    version: '1.12.0',
  }),
};
const loggerMock = { log: jest.fn() };
const envMock = {
  appEnvironment: 'production',
  githubToken: 'your-token',
  versionCheckTtlSeconds: 600,
  versionRepoApi: 'your-org/your-api',
  versionRepoApp: 'your-org/your-app',
};

// endregion Mocks

let setup: GetVersionInfoUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00Z'));
  Object.assign(envMock, {
    appEnvironment: 'production',
    versionCheckTtlSeconds: 600,
    versionRepoApi: 'your-org/your-api',
    versionRepoApp: 'your-org/your-app',
  });
  githubMock.listReleases.mockImplementation(async (repo: string) =>
    repo === 'your-org/your-api'
      ? [releaseMock('v1.12.0'), releaseMock('v1.13.0'), releaseMock('nightly')]
      : [releaseMock('v1.5.0')],
  );

  const module = await Test.createTestingModule({
    providers: [
      GetVersionInfoUseCase,
      { provide: 'IGithubReleases', useValue: githubMock },
      { provide: 'IBuildInfo', useValue: buildInfoMock },
      { provide: 'ILogger', useValue: loggerMock },
      { provide: EnvService, useValue: envMock },
    ],
  }).compile();

  setup = module.get(GetVersionInfoUseCase);
});

afterEach(() => jest.useRealTimers());

const mocks = { env: envMock, release: releaseMock };
const spies = { github: githubMock.listReleases, logger: loggerMock.log, warn: LogLevel.WARN };

export { mocks, setup, spies };
