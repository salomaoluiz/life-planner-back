import { faker } from '@faker-js/faker';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { Validation } from '@shared/infra/validation';
import { Validator } from '@shared/infra/validation/builder/zod/base';

// region Mocks Success
const titlePrefix = 'String Validation';

const successCodes = [
  'valid_string',
  'empty_string',
  'optional_string_with_undefined',
  'valid_email',
  'minimum_length_validation',
] as const;

function buildSuccess(schema: Validator<string | undefined>, value: unknown) {
  return {
    expected: {
      data: value,
      error: undefined,
      success: true,
    },
    schema: schema,
    value: value,
  };
}

const successValues: Record<(typeof successCodes)[number], unknown> = {
  empty_string: '',
  minimum_length_validation: 'Hello',
  optional_string_with_undefined: undefined,
  valid_email: faker.internet.email(),
  valid_string: 'This is a valid string',
};

const successSchemas = {
  empty_string: Validation.schema.string.required(),
  minimum_length_validation: Validation.schema.string.min(5),
  optional_string_with_undefined: Validation.schema.string.optional(),
  valid_email: Validation.schema.string.email(),
  valid_string: Validation.schema.string.required(),
};

const successTitles = {
  empty_string: `${titlePrefix} - Success - Empty string`,
  minimum_length_validation: `${titlePrefix} - Success - Minimum length validation`,
  optional_string_with_undefined: `${titlePrefix} - Success - Optional string with undefined value`,
  valid_email: `${titlePrefix} - Success - Email validation with valid email`,
  valid_string: `${titlePrefix} - Success - Valid string`,
};

const successTestCases = successCodes.map((key) => ({
  ...buildSuccess(successSchemas[key], successValues[key]),
  key,
  test: successTitles[key],
}));

// endregion Mocks Success

// region Mocks Error

const errorTestCodes = [
  'invalid_array',
  'invalid_boolean',
  'invalid_object',
  'invalid_number',
  'invalid_email',
  'minimum_length_failed',
] as const;

function buildError(value: unknown, schema: Validator<string | undefined>, error: ValidationError) {
  return {
    expected: {
      data: undefined,
      error: error,
      success: false,
    },
    schema: schema,
    value: value,
  };
}
function buildInvalidTypeError(type: string) {
  return new ValidationError([
    {
      code: 'invalid_type',
      expected: 'string',
      message: `Invalid input: expected string, received ${type}`,
    },
  ]);
}

const errors = {
  invalid_array: buildInvalidTypeError('array'),
  invalid_boolean: buildInvalidTypeError('boolean'),
  invalid_email: new ValidationError([
    {
      code: 'invalid_format',
      expected: undefined,
      message: 'Invalid email address',
    },
  ]),
  invalid_number: buildInvalidTypeError('number'),
  invalid_object: buildInvalidTypeError('object'),
  minimum_length_failed: new ValidationError([
    {
      code: 'too_small',
      expected: undefined,
      message: 'Too small: expected string to have >=5 characters',
    },
  ]),
};

const errorTitles = {
  invalid_array: `${titlePrefix} - Error - Non-string value (array)`,
  invalid_boolean: `${titlePrefix} - Error - Non-string value (boolean)`,
  invalid_email: `${titlePrefix} - Error - Email validation with invalid email`,
  invalid_number: `${titlePrefix} - Error - Non-string value (number)`,
  invalid_object: `${titlePrefix} - Error - Non-string value (object)`,
  minimum_length_failed: `${titlePrefix} - Error - Minimum length validation failed`,
};

const errorValues = {
  invalid_array: ['string in array'],
  invalid_boolean: true,
  invalid_email: 'invalid-email',
  invalid_number: 123,
  invalid_object: { key: 'value' },
  minimum_length_failed: 'Hi',
};

const errorSchemas = {
  invalid_array: Validation.schema.string.required(),
  invalid_boolean: Validation.schema.string.required(),
  invalid_email: Validation.schema.string.email(),
  invalid_number: Validation.schema.string.required(),
  invalid_object: Validation.schema.string.required(),
  minimum_length_failed: Validation.schema.string.min(5),
};

const errorTestCases = errorTestCodes.map((key) => ({
  ...buildError(errorValues[key], errorSchemas[key], errors[key]),
  key,
  test: errorTitles[key],
}));

// endregion Mocks Error

const testCases = [...successTestCases, ...errorTestCases];

export { testCases };
