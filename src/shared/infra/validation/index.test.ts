import { faker } from '@faker-js/faker';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { Validation } from './index';
import * as number from './mocks/number.mocks';
import * as string from './mocks/string.mocks';

const testCases = [...number.testCases, ...string.testCases];

test.each(testCases)('$test - $key', ({ expected, schema, value }) => {
  const result = schema(value);

  expect(result.data).toEqual(expected.data);
  expect(result.success).toBe(expected.success);
  if (expected.error) {
    expect(result.error).toBeInstanceOf(ValidationError);
    expect((result.error as ValidationError).details).toEqual(
      (expected.error as ValidationError).details,
    );
  } else {
    expect(result.error).toBeUndefined();
  }
});

test.each(testCases)('Object - $test - $key', ({ expected, schema, value }) => {
  const objectToTest = { field: schema };

  const result = Validation.validate(objectToTest, { field: value });

  expect(result.data).toEqual(expected.success ? { field: expected.data } : undefined);
  expect(result.success).toBe(expected.success);
  if (!expected.error) {
    expect(result.error).toBeUndefined();
  } else {
    expect(result.error).toBeInstanceOf(ValidationError);
    expect((result.error as ValidationError).details).toEqual(
      (expected.error as ValidationError).details.map((detail) => ({
        ...detail,
        field: 'field',
      })),
    );
  }
});

it('SHOULD validate an schema with multiple fields', () => {
  const schema = {
    age: Validation.schema.number.min(18),
    email: Validation.schema.string.email(),
  };

  const input = {
    age: 20,
    email: faker.internet.email(),
  };

  const result = Validation.validate(schema, input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual(input);
});

it('SHOULD return all errors when validating an schema with multiple fields', () => {
  const schema = {
    age: Validation.schema.number.min(18),
    email: Validation.schema.string.email(),
  };

  const input = {
    age: 16,
    email: 'invalid-email',
  };

  const result = Validation.validate(schema, input);

  expect(result.success).toBe(false);
  expect(result.data).toBeUndefined();
  expect(result.error).toBeInstanceOf(ValidationError);
  expect((result.error as ValidationError).details).toEqual([
    {
      code: 'too_small',
      expected: undefined,
      field: 'age',
      message: 'Too small: expected number to be >=18',
    },
    {
      code: 'invalid_format',
      expected: undefined,
      field: 'email',
      message: 'Invalid email address',
    },
  ]);
});
