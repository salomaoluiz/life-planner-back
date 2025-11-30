import { z } from 'zod';

import { ValidationError } from '@shared/domain/error/ValidationError';

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues.map((err) => ({
    code: err.code,
    field: err.path.join('.'),
    message: err.message,
  }));

  throw new ValidationError(details);
}
