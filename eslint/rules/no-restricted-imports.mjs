import { internalModules } from './constants.mjs';

const preventAbsoluteImports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../../*', '../../'],
            message: 'Please use absolute imports',
          },
        ],
      },
    ],
  },
};

const allowedInternalPatterns = internalModules.flatMap((module) => [
  `!${module}`,
  `!${module}/**`,
]);

const allowedTestPatterns = ['!jest', '!@faker-js', '!@faker-js/**'];

const allowedAbsolutePatterns = ['!./', '!../', '!./**', '!../**'];

const nestPatterns = ['!@nestjs', '!@nestjs/**', '@nestjs/config'];

const preventInfraLibsImports = {
  files: ['**/*.ts'],
  ignores: ['src/shared/infra/**/*'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '*',
              '!@shared/infra',
              '!@shared/infra/**',
              '!zod',
              ...nestPatterns,
              ...allowedTestPatterns,
              ...allowedAbsolutePatterns,
              ...allowedInternalPatterns,
            ],
            message: 'Please, import this lib from "@shared/infra" instead',
          },
        ],
      },
    ],
  },
};

export default [preventAbsoluteImports, preventInfraLibsImports];
