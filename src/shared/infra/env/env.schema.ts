import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.url(),

  // JWT
  JWT_EXPIRES_IN: z.number().default(3600),
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
