import { z } from 'zod';

// Compose passes unset optional variables as empty strings.
const emptyToUndefined = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

// Optional string; an empty string (unset compose/.env value) falls back to the default.
function withDefault(fallback: string) {
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? fallback : value));
}

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

  // Stock forecast (spec 123): seconds-scale cache of the stale-forecast check on reads, 0 disables it
  STOCK_FORECAST_GATE_TTL_MS: optionalInt(0, 60000),

  // Name embeddings for the stock suggestions (spec 116): an empty key disables them (trigram only)
  EMBEDDINGS_API_KEY: emptyToUndefined,
  EMBEDDINGS_API_URL: emptyToUndefined,
  EMBEDDINGS_DIMENSIONS: optionalInt(1, 1024),
  EMBEDDINGS_MODEL: emptyToUndefined,

  // Stock suggestions by AI (spec 121): an empty key disables the AI steps (Open Food Facts only)
  GOOGLE_AI_API_KEY: emptyToUndefined,
  GOOGLE_AI_API_URL: withDefault('https://generativelanguage.googleapis.com/v1beta'),
  GOOGLE_AI_SEARCH_MODEL: withDefault('gemini-2.5-flash'),
  LLM_API_KEY: emptyToUndefined,
  LLM_API_URL: emptyToUndefined,
  LLM_DAILY_LIGHT_LIMIT: optionalInt(0, 50),
  LLM_DAILY_SEARCH_LIMIT: optionalInt(0, 10),
  LLM_MODEL_LIGHT: emptyToUndefined,
  LLM_MODEL_SEARCH: emptyToUndefined,
  LLM_TIMEOUT_LIGHT_MS: optionalInt(1, 6000),
  LLM_TIMEOUT_SEARCH_MS: optionalInt(1, 15000),
  LLM_USAGE_TIMEZONE: withDefault('America/Sao_Paulo'),
  OPEN_FOOD_FACTS_TIMEOUT_MS: optionalInt(1, 2000),
  OPEN_FOOD_FACTS_URL: withDefault('https://world.openfoodfacts.org'),
  OPEN_FOOD_FACTS_USER_AGENT: withDefault('LifePlanner/1.0'),

  // Investment quotes (spec 104): tokens are optional, a missing one disables that source
  BRAPI_TOKEN: emptyToUndefined,
  FINNHUB_TOKEN: emptyToUndefined,
  INVESTMENT_INCOME_SERIES_JOB_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value !== 'false'),
  INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS: optionalInt(0, 60000),
  INVESTMENT_QUOTES_BRAPI_BATCH_SIZE: optionalInt(1, 20),
  INVESTMENT_QUOTES_JOB_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value !== 'false'),
  INVESTMENT_QUOTES_MIN_INTERVAL_MS: optionalInt(0, 0),
  MARKET_INDEX_JOB_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value !== 'false'),

  // Activity history (spec 127): retention window and its daily purge job
  ACTIVITY_RETENTION_DAYS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).default(183),
  ),
  ACTIVITY_RETENTION_JOB_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value !== 'false'),

  // Notifications (spec 124): the tick job and the push providers (empty VAPID keys disable Web Push)
  EXPO_ACCESS_TOKEN: emptyToUndefined,
  NOTIFICATION_JOB_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value !== 'false'),
  NOTIFICATION_TICK_MINUTES: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .int()
      .refine((value) => [1, 10, 15, 20, 30, 5, 60].includes(value), {
        message: 'NOTIFICATION_TICK_MINUTES must be one of 1, 5, 10, 15, 20, 30, 60',
      })
      .default(15),
  ),
  VAPID_PRIVATE_KEY: emptyToUndefined,
  VAPID_PUBLIC_KEY: emptyToUndefined,
  VAPID_SUBJECT: emptyToUndefined,

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

  // Monitoring (spec 106): absent DSN or SENTRY_ENABLED != 'true' disables Sentry
  SENTRY_DSN: emptyToUndefined,
  SENTRY_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform((value) => value === 'true'),
  SENTRY_ENVIRONMENT: emptyToUndefined,
  SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().min(0).max(1).default(0),
  ),

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
