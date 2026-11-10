import { mocks, setup, spies } from './env.service.mocks';

type EnvService = Awaited<EnvServicePromise>;
type EnvServiceKey = keyof EnvService;
type EnvServicePromise = ReturnType<typeof setup>;
type EnvVarKey = keyof typeof mocks.envVars;

const testCases: { key: EnvVarKey; method: EnvServiceKey }[] = [
  { key: 'NODE_ENV', method: 'environment' },
  { key: 'APP_ENVIRONMENT', method: 'appEnvironment' },
  { key: 'BRAPI_TOKEN', method: 'brapiToken' },
  { key: 'FINNHUB_TOKEN', method: 'finnhubToken' },
  { key: 'INVESTMENT_QUOTES_BRAPI_BATCH_SIZE', method: 'investmentQuotesBrapiBatchSize' },
  { key: 'INVESTMENT_QUOTES_JOB_ENABLED', method: 'investmentQuotesJobEnabled' },
  { key: 'INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS', method: 'investmentQuoteRefreshCooldownMs' },
  { key: 'GITHUB_TOKEN', method: 'githubToken' },
  { key: 'VERSION_CHECK_TTL_SECONDS', method: 'versionCheckTtlSeconds' },
  { key: 'VERSION_REPO_API', method: 'versionRepoApi' },
  { key: 'VERSION_REPO_APP', method: 'versionRepoApp' },
  { key: 'PERF_COUNT_QUERIES', method: 'perfCountQueries' },
  { key: 'PORT', method: 'port' },
  { key: 'CORS_ORIGINS', method: 'corsOrigins' },
  { key: 'DB_HOST', method: 'dbHost' },
  { key: 'DB_NAME', method: 'dbName' },
  { key: 'DB_PASSWORD', method: 'dbPassword' },
  { key: 'DB_POOL_CONNECTION_TIMEOUT_MS', method: 'dbPoolConnectionTimeoutMs' },
  { key: 'DB_POOL_IDLE_TIMEOUT_MS', method: 'dbPoolIdleTimeoutMs' },
  { key: 'DB_POOL_MAX', method: 'dbPoolMax' },
  { key: 'DB_PORT', method: 'dbPort' },
  { key: 'DB_STATEMENT_TIMEOUT_MS', method: 'dbStatementTimeoutMs' },
  { key: 'DB_USER', method: 'dbUser' },
  { key: 'FINANCE_MATERIALIZATION_GATE_TTL_MS', method: 'financeMaterializationGateTtlMs' },
  { key: 'JWT_EXPIRES_IN', method: 'jwtExpiresIn' },
  { key: 'JWT_SECRET', method: 'jwtSecret' },
  { key: 'SENTRY_DSN', method: 'sentryDsn' },
  { key: 'SENTRY_ENABLED', method: 'sentryEnabled' },
  { key: 'SENTRY_ENVIRONMENT', method: 'sentryEnvironment' },
  { key: 'SENTRY_TRACES_SAMPLE_RATE', method: 'sentryTracesSampleRate' },
  { key: 'SESSION_IDLE_TTL_SECONDS', method: 'sessionIdleTtlSeconds' },
  { key: 'SWAGGER_ENABLED', method: 'swaggerEnabled' },
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
