import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DB_HOST: z.string(),
  DB_NAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_PORT: z.string(),
  DB_USER: z.string(),

  // JWT
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  JWT_SECRET: z.string().min(10),
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
