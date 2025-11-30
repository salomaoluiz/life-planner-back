import { z } from 'zod';

import { ValidationError } from '@shared/domain/error/ValidationError';

export type ValidationResult<T> =
  | { data: T; error: undefined; success: true }
  | { data: undefined; error: ValidationError; success: false };
export type Validator<T> = (input?: unknown) => ValidationResult<T>;

export function createValidator<T>(fn: (input: unknown) => z.ZodSafeParseResult<T>): Validator<T> {
  return (input: unknown) => {
    const result = fn(input);
    if (result.success) {
      return { data: result.data as T, error: undefined, success: true };
    }
    const error = new ValidationError(
      result.error.issues.map((err) => ({
        code: err.code,
        expected: (err as { expected: string }).expected,
        message: err.message,
      })),
    );

    return { data: undefined, error, success: false };
  };
}
export function validateSchema<T>(
  schema: Record<keyof T, Validator<unknown>>,
  input: Record<string, unknown> & unknown,
): ValidationResult<T> {
  if (typeof input !== 'object' || input === null) {
    const error = new ValidationError([
      {
        code: 'invalid_type',
        expected: 'object',
        message: `Invalid input: expected object, received ${input === null ? 'null' : typeof input}`,
      },
    ]);
    return { data: undefined, error, success: false };
  }

  const resultObject = {} as Record<string, unknown>;
  const errors: Record<string, ValidationError> = {};

  for (const key in schema) {
    const validator = schema[key];
    const data = input[key as keyof typeof input];
    const result = validator(data);

    if (!result.success) {
      errors[key] = result.error;
    } else {
      resultObject[key as keyof typeof resultObject] = result.data;
    }
  }

  if (Object.keys(errors).length > 0) {
    const error = new ValidationError(
      Object.entries(errors).reduce(
        (previousValue, currentValue) => {
          const [key, validationError] = currentValue;
          const errorDetailsWithKey = validationError.details.map((detail) => ({
            ...detail,
            field: key,
          }));
          return [...previousValue, ...errorDetailsWithKey];
        },
        [] as ValidationError['details'],
      ),
    );

    return { data: undefined, error, success: false };
  }

  return { data: resultObject as T, error: undefined, success: true };
}
