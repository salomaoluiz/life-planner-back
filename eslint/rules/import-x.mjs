import { importX } from 'eslint-plugin-import-x';

// This file is used to configure the import-x plugin.

export default {
  ...importX.flatConfigs.recommended,
  ...importX.flatConfigs.typescript,
  rules: {
    // This rule is used to prevent circular dependencies.
    'import-x/no-cycle': [
      'error',
      {
        maxDepth: 3,
      },
    ],
  },
  settings: {
    'import-x/parser': {
      '@typescript-eslint/parser': ['**/*.ts'],
    },
    'import-x/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      typescript: true,
    },
  },
};
