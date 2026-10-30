import { mocks, setup, throwableSetup } from './env.schema.mocks';

describe('validateEnvironment', () => {
  it('SHOULD return validated environment variables WHEN config is valid', () => {
    const result = setup(mocks.validConfig);

    expect(result).toEqual({
      ...mocks.validConfig,
      APP_ENVIRONMENT: 'development',
      CORS_ORIGINS: '',
      JWT_EXPIRES_IN: 7200, // Coerced
      PORT: 4000, // Coerced
      SESSION_IDLE_TTL_SECONDS: 172800,
      SWAGGER_ENABLED: true,
      VERSION_CHECK_TTL_SECONDS: 600,
    });
  });

  it('SHOULD validate the version variables (spec 056)', () => {
    const result = setup({
      ...mocks.validConfig,
      APP_ENVIRONMENT: 'staging',
      GITHUB_TOKEN: '',
      VERSION_CHECK_TTL_SECONDS: '30',
      VERSION_REPO_API: 'your-org/your-api',
    });

    expect(result).toMatchObject({
      APP_ENVIRONMENT: 'staging',
      GITHUB_TOKEN: undefined,
      VERSION_CHECK_TTL_SECONDS: 30,
      VERSION_REPO_API: 'your-org/your-api',
    });
    expect(result.VERSION_REPO_APP).toBeUndefined();
    expect(throwableSetup({ ...mocks.validConfig, APP_ENVIRONMENT: 'qa' })).toBeInstanceOf(Error);
    expect(throwableSetup({ ...mocks.validConfig, VERSION_CHECK_TTL_SECONDS: '0' })).toBeInstanceOf(
      Error,
    );
  });

  it('SHOULD use default values WHEN optional fields are missing', () => {
    const result = setup(mocks.partialConfig);

    expect(result).toMatchObject({
      CORS_ORIGINS: '',
      JWT_EXPIRES_IN: 3600,
      NODE_ENV: 'development',
      PORT: 3000,
      SESSION_IDLE_TTL_SECONDS: 172800,
    });
  });

  it('SHOULD keep CORS_ORIGINS WHEN provided', () => {
    const result = setup({ ...mocks.validConfig, CORS_ORIGINS: 'http://localhost:8081' });

    expect(result.CORS_ORIGINS).toBe('http://localhost:8081');
  });

  it('SHOULD default SESSION_IDLE_TTL_SECONDS to 2 days AND coerce a provided value', () => {
    expect(setup(mocks.partialConfig).SESSION_IDLE_TTL_SECONDS).toBe(172800);
    expect(
      setup({ ...mocks.validConfig, SESSION_IDLE_TTL_SECONDS: '3600' }).SESSION_IDLE_TTL_SECONDS,
    ).toBe(3600);
  });

  it('SHOULD reject a non-positive SESSION_IDLE_TTL_SECONDS', () => {
    expect(throwableSetup({ ...mocks.validConfig, SESSION_IDLE_TTL_SECONDS: '0' })).toBeInstanceOf(
      Error,
    );
  });

  it.each([
    { expected: false, raw: 'false' },
    { expected: true, raw: 'true' },
    { expected: true, raw: undefined },
  ])('SHOULD parse SWAGGER_ENABLED=$raw as $expected', ({ expected, raw }) => {
    const result = setup({ ...mocks.partialConfig, SWAGGER_ENABLED: raw });

    expect(result.SWAGGER_ENABLED).toBe(expected);
  });

  it.each(['banana', '0', '1', 'FALSE', ''])('SHOULD reject SWAGGER_ENABLED=%j', (raw) => {
    expect(throwableSetup({ ...mocks.partialConfig, SWAGGER_ENABLED: raw })).toBeInstanceOf(Error);
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
