import { mocks, setup, throwableSetup } from './env.schema.mocks';

describe('validateEnvironment', () => {
  it('SHOULD return validated environment variables WHEN config is valid', () => {
    const result = setup(mocks.validConfig);

    expect(result).toEqual({
      ...mocks.validConfig,
      JWT_EXPIRES_IN: 7200, // Coerced
      PORT: 4000, // Coerced
    });
  });

  it('SHOULD use default values WHEN optional fields are missing', () => {
    const result = setup(mocks.partialConfig);

    expect(result).toMatchObject({
      JWT_EXPIRES_IN: 3600,
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('SHOULD throw Error WHEN config is invalid', () => {
    const result = throwableSetup(mocks.invalidConfig);

    expect(result).toBeInstanceOf(Error);
  });

  it('SHOULD include validation details in error message WHEN config fails validation', () => {
    const result = throwableSetup(mocks.invalidConfig) as Error;

    const json = {
      errors: [],
      properties: {
        DB_HOST: { errors: ['Invalid input: expected string, received undefined'] },
        DB_NAME: { errors: ['Invalid input: expected string, received undefined'] },
        DB_PASSWORD: { errors: ['Invalid input: expected string, received undefined'] },
        DB_PORT: { errors: ['Invalid input: expected string, received undefined'] },
        DB_USER: { errors: ['Invalid input: expected string, received undefined'] },
        JWT_SECRET: { errors: ['Invalid input: expected string, received undefined'] },
        NODE_ENV: {
          errors: ['Invalid option: expected one of \\"development\\"|\\"production\\"|\\"test\\"'],
        },
        PORT: { errors: ['Invalid input: expected number, received NaN'] },
      },
    };

    const keys = Object.keys(json.properties);
    keys.forEach((key) => {
      expect(result.message).toContain(
        json.properties[key as keyof typeof json.properties].errors[0],
      );
    });
  });
});
