import { z } from 'zod';

// Compose passes unset optional variables as empty strings.
const emptyToUndefined = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

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

  // JWT
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  JWT_SECRET: z.string().min(10),

  // Versions (spec 056)
  GITHUB_TOKEN: emptyToUndefined,
  VERSION_CHECK_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  VERSION_REPO_API: emptyToUndefined,
  VERSION_REPO_APP: emptyToUndefined,

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
