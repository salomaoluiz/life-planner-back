import { mocks, setup, spies } from './env.service.mocks';

type EnvService = Awaited<EnvServicePromise>;
type EnvServiceKey = keyof EnvService;
type EnvServicePromise = ReturnType<typeof setup>;
type EnvVarKey = keyof typeof mocks.envVars;

const testCases: { key: EnvVarKey; method: EnvServiceKey }[] = [
  { key: 'NODE_ENV', method: 'environment' },
  { key: 'PORT', method: 'port' },
  { key: 'DB_HOST', method: 'dbHost' },
  { key: 'DB_NAME', method: 'dbName' },
  { key: 'DB_PASSWORD', method: 'dbPassword' },
  { key: 'DB_PORT', method: 'dbPort' },
  { key: 'DB_USER', method: 'dbUser' },
  { key: 'JWT_EXPIRES_IN', method: 'jwtExpiresIn' },
  { key: 'JWT_SECRET', method: 'jwtSecret' },
];

test.each(testCases)(
  'SHOULD return the correct value for $method mapped to env $key',
  async ({ key, method }) => {
    const service = await setup();

    const result = service[method];

    expect(spies.nestConfigServiceGet).toHaveBeenCalledTimes(1);
    expect(spies.nestConfigServiceGet).toHaveBeenCalledWith(key);
    expect(result).toBe(mocks.envVars[key]);
  },
);
