// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require('../jest.config.js');

// Not part of `yarn test`: it needs the database of .env. Run it through `yarn perf`.
module.exports = {
  moduleDirectories: base.moduleDirectories,
  moduleNameMapper: base.moduleNameMapper,
  preset: base.preset,
  rootDir: '..',
  setupFiles: ['<rootDir>/perf/setup-env.ts'],
  testEnvironment: 'node',
  testRegex: 'perf/.*\\.perf\\.test\\.ts$',
  testTimeout: 600_000,
  transform: base.transform,
  transformIgnorePatterns: base.transformIgnorePatterns,
};
