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

const preventInfraLibsImports = {
  files: ['**/*.{js,ts,tsx,jsx}'],
  ignores: ['src/shared/infra/**/*'],
  rules: {
    'no-restricted-imports': [
      'error',
      // {
      //   message: 'Please, use `@infrastructure/monitoring` instead',
      //   name: '@sentry/react-native',
      // },
    ],
  },
};

export default [preventAbsoluteImports, preventInfraLibsImports];
