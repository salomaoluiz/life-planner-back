import { EnvService } from '@shared/infra/env/env.service';
import { ILogger } from '@shared/infra/logger/types';

const clientHandlers: Record<string, (value?: unknown) => void> = {};
const client = {
  connect: jest.fn().mockResolvedValue(undefined),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn((event: string, handler: (value?: unknown) => void) => {
    clientHandlers[event] = handler;
  }),
  query: jest.fn().mockResolvedValue(undefined),
};
const env = {
  dbHost: 'localhost',
  dbName: 'db',
  dbPassword: 'pass',
  dbPort: '5432',
  dbUser: 'user',
} as unknown as EnvService;
const logger: ILogger = { log: jest.fn() };

export { client, clientHandlers, env, logger };
