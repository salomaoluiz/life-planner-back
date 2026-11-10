import { z } from 'zod';

// Compose passes unset optional variables as empty strings.
const emptyToUndefined = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

// Optional integer; an empty string (unset compose/.env value) falls back to the default.
function optionalInt(min: number, fallback: number) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(min).default(fallback),
  );
}

export const envSchema = z.object({
  // App
  APP_ENVIRONMENT: z.enum(['development', 'production', 'staging']).default('development'),
  CORS_ORIGINS: z.string().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Docs
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Database
  DB_HOST: z.string(),
  DB_NAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_PORT: z.string(),
  DB_USER: z.string(),
  // Connection pool of the pg driver behind Prisma. 0 disables a timeout.
  DB_POOL_CONNECTION_TIMEOUT_MS: optionalInt(0, 0),
  DB_POOL_IDLE_TIMEOUT_MS: optionalInt(0, 30000),
  DB_POOL_MAX: optionalInt(1, 20),
  DB_STATEMENT_TIMEOUT_MS: optionalInt(0, 0),

  // Finance (spec 081): seconds-scale cache of the recurrence materialization check, 0 disables it
  FINANCE_MATERIALIZATION_GATE_TTL_MS: optionalInt(0, 60000),

  // Investment quotes (spec 104): tokens are optional, a missing one disables that source
  BRAPI_TOKEN: emptyToUndefined,
  FINNHUB_TOKEN: emptyToUndefined,
  INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS: optionalInt(0, 60000),
  INVESTMENT_QUOTES_BRAPI_BATCH_SIZE: optionalInt(1, 20),
  INVESTMENT_QUOTES_JOB_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value !== 'false'),

  // JWT
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  JWT_SECRET: z.string().min(10),

  // Versions (spec 056)
  GITHUB_TOKEN: emptyToUndefined,
  VERSION_CHECK_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  VERSION_REPO_API: emptyToUndefined,
  VERSION_REPO_APP: emptyToUndefined,

  // Perf guardrail (spec 065): count SQL statements per request
  PERF_COUNT_QUERIES: z
    .enum(['0', '1', ''])
    .optional()
    .transform((value) => value === '1'),

  // Sessions
  SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().positive().default(172800),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables - ${JSON.stringify(z.treeifyError(result.error))}`,
    );
  }

  return result.data;
}
