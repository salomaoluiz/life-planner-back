import { validateEnvironment } from './env.schema';

// region Mocks

const validConfigMock = {
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_PASSWORD: 'secure_password',
  DB_PORT: '5432',
  DB_USER: 'admin',
  JWT_EXPIRES_IN: '7200', // Testing coercion
  JWT_SECRET: 'super_secret_key_minimum_10_chars',
  NODE_ENV: 'production',
  PORT: '4000', // Testing coercion
};

// Missing required fields and invalid types
const invalidConfigMock = {
  NODE_ENV: 'invalid_environment',
  PORT: 'not_a_number',
  // DB_HOST missing
};

// Only required fields to test defaults
const partialConfigMock = {
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_PASSWORD: 'password',
  DB_PORT: '5432',
  DB_USER: 'user',
  JWT_SECRET: '1234567890',
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(config: Record<string, unknown> = validConfigMock) {
  return validateEnvironment(config);
}
function throwableSetup(config: Record<string, unknown> = validConfigMock) {
  try {
    setup(config);
  } catch (error) {
    return error;
  }
}

const mocks = {
  invalidConfig: invalidConfigMock,
  partialConfig: partialConfigMock,
  validConfig: validConfigMock,
};

const spies = {};

export { mocks, setup, spies, throwableSetup };
