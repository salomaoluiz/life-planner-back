import { ValidationError } from '@shared/domain/error/ValidationError';
import { Validation } from '@shared/infra/validation';
import { Validator } from '@shared/infra/validation/builder/zod/base';

// region Mocks Success
const titlePrefix = 'Number Validation';

function buildSuccess(value: number, schema: Validator<number>) {
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

const successCodes = [
  'minimum_value_validation',
  'positive_number_validation',
  'valid_float_number',
  'valid_number',
] as const;

const successValues: Record<(typeof successCodes)[number], number> = {
  minimum_value_validation: 100,
  positive_number_validation: 25,
  valid_float_number: 3.14,
  valid_number: 42,
};

const successSchemas = {
  minimum_value_validation: Validation.schema.number.min(50),
  positive_number_validation: Validation.schema.number.positive(),
  valid_float_number: Validation.schema.number.required(),
  valid_number: Validation.schema.number.required(),
};

const successTitles = {
  minimum_value_validation: `${titlePrefix} - Success - Minimum value validation passed`,
  positive_number_validation: `${titlePrefix} - Success - Positive number validation passed`,
  valid_float_number: `${titlePrefix} - Success - Valid float number`,
  valid_number: `${titlePrefix} - Success - Valid integer number`,
};

const successTestCases = successCodes.map((key) => ({
  ...buildSuccess(successValues[key], successSchemas[key]),
  key,
  test: successTitles[key],
}));

// endregion Mocks Success

// region Mocks Error

const errorTestCodes = [
  'invalid_array',
  'invalid_boolean',
  'invalid_object',
  'invalid_string',
  'minimum_failed',
  'positive_failed',
] as const;

function buildError(value: unknown, schema: Validator<number>, error: ValidationError) {
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
      expected: 'number',
      message: `Invalid input: expected number, received ${type}`,
    },
  ]);
}

const errors = {
  invalid_array: buildInvalidTypeError('array'),
  invalid_boolean: buildInvalidTypeError('boolean'),
  invalid_object: buildInvalidTypeError('object'),
  invalid_string: buildInvalidTypeError('string'),
  minimum_failed: new ValidationError([
    { code: 'too_small', expected: undefined, message: 'Too small: expected number to be >=10' },
  ]),
  positive_failed: new ValidationError([
    { code: 'too_small', expected: undefined, message: 'Too small: expected number to be >0' },
  ]),
};

const errorTitles = {
  invalid_array: `${titlePrefix} - Error - Non-number value (array)`,
  invalid_boolean: `${titlePrefix} - Error - Non-number value (boolean)`,
  invalid_object: `${titlePrefix} - Error - Non-number value (object)`,
  invalid_string: `${titlePrefix} - Error - Invalid number (string)`,
  minimum_failed: `${titlePrefix} - Error - Minimum value validation failed`,
  positive_failed: `${titlePrefix} - Error - Positive number validation failed`,
};

const errorValues = {
  invalid_array: ['not', 'a', 'number'],
  invalid_boolean: false,
  invalid_object: { key: 'value' },
  invalid_string: '123abc',
  minimum_failed: 5,
  positive_failed: -10,
};

const errorSchemas = {
  invalid_array: Validation.schema.number.required(),
  invalid_boolean: Validation.schema.number.required(),
  invalid_object: Validation.schema.number.required(),
  invalid_string: Validation.schema.number.required(),
  minimum_failed: Validation.schema.number.min(10),
  positive_failed: Validation.schema.number.positive(),
};

const errorTestCases = errorTestCodes.map((key) => ({
  ...buildError(errorValues[key], errorSchemas[key], errors[key]),
  key,
  test: errorTitles[key],
}));

// endregion Mocks Error

const testCases = [...successTestCases, ...errorTestCases];

export { testCases };
