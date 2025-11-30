import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, throwableSetup } from './index.mocks';

it('SHOULD return the data validated', () => {
  const result = setup();

  expect(result).toEqual(mocks.data);
});

it('SHOULD throw ValidationError WHEN data is invalid', () => {
  const schema = mocks.defaultProps[0];
  const invalidData = {
    testField: 123,
  };
  const result = throwableSetup([schema, invalidData]);

  expect(result).toBeInstanceOf(ValidationError);
  expect((result as ValidationError).details).toEqual([
    {
      code: 'invalid_type',
      field: 'testField',
      message: 'Invalid input: expected string, received number',
    },
  ]);
});
