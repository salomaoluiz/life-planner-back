import perfectionist from 'eslint-plugin-perfectionist';
import { internalModules } from './constants.mjs';

const defaultSortRule = {
  level: 'error',
  options: {
    newlinesBetween: 1,
    partitionByComment: true,
  },
};

const defaultRulesList = [
  'perfectionist/sort-array-includes',
  'perfectionist/sort-enums',
  'perfectionist/sort-interfaces',
  'perfectionist/sort-intersection-types',
  'perfectionist/sort-maps',
  'perfectionist/sort-modules',
  'perfectionist/sort-named-exports',
  'perfectionist/sort-named-imports',
  'perfectionist/sort-object-types',
  'perfectionist/sort-objects',
  'perfectionist/sort-sets',
  'perfectionist/sort-union-types',
  'perfectionist/sort-variable-declarations',
];

const defaultRulesApplied = defaultRulesList.reduce((previousValue, currentValue) => {
  previousValue[currentValue] = [defaultSortRule.level, defaultSortRule.options];
  return previousValue;
}, {});

export default {
  ...perfectionist.configs['recommended-natural'],
  rules: {
    ...perfectionist.configs['recommended-natural'].rules,
    ...defaultRulesApplied,
    'perfectionist/sort-exports': [
      'error',
      {
        fallbackSort: { order: 'asc', type: 'line-length' },
        groupKind: 'types-first',
        ignoreCase: true,
        order: 'asc',
        partitionByComment: false,
        partitionByNewLine: false,
        specialCharacters: 'keep',
        type: 'alphabetical',
      },
    ],
    'perfectionist/sort-imports': [
      'error',
      {
        customGroups: {
          type: {
            internal: internalModules.map((module) => `^${module}`),
          },
          value: {
            test: '@tests',
            internal: internalModules.map((module) => `^${module}`),
          },
        },
        fallbackSort: { order: 'asc', type: 'line-length' },
        groups: [
          ['builtin', 'external', 'builtin-type', 'external-type'],
          ['test'],
          ['internal', 'internal-type'],
          ['parent', 'sibling', 'index', 'sibling-type', 'parent-type', 'index-type'],
        ],
        ignoreCase: true,
        newlinesBetween: 'always',
        order: 'asc',
        specialCharacters: 'keep',
        type: 'alphabetical',
      },
    ],
    'perfectionist/sort-classes': [
      defaultSortRule.level,
      {
        ...defaultSortRule.options,
        groups: [
          'index-signature',
          'static-property',
          'static-block',
          ['protected-property', 'protected-accessor-property'],
          ['private-property', 'private-accessor-property'],
          ['property', 'accessor-property'],
          'constructor',
          'static-method',
          'protected-method',
          'private-method',
          'methods-with-spacing',
          ['get-method', 'set-method'],
          'unknown',
        ],
        customGroups: [
          {
            groupName: 'constructor',
            selector: 'constructor',
          },
          {
            groupName: 'methods-with-spacing',
            selector: 'method',
            newlinesInside: 1,
          },
        ],
      },
    ],
  },
};
