/* eslint-disable no-undef */
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!**/*.fixture.ts',
    '!**/*.fixtures.ts',
    '!**/*.mock.ts',
    '!**/*.mocks.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@family/(.*)$': '<rootDir>/src/modules/family/$1',
    '^@finance/(.*)$': '<rootDir>/src/modules/finance/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@stock/(.*)$': '<rootDir>/src/modules/stock/$1',
    '^@user/(.*)$': '<rootDir>/src/modules/user/$1',
    '^@db/(.*)$': '<rootDir>/generated/prisma/$1',
  },
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/tests/'],
  testRegex: '.*\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: ['jest-runner'],
};
