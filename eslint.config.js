import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import importPlugin from 'eslint-plugin-import-x'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.husky/**', 'vite.config.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // JS/TS базовые
      'no-param-reassign': 'off',
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'prefer-destructuring': ['error', { object: true, array: false }],
      'no-console': 'warn',
      'no-debugger': 'error',
      'object-shorthand': ['error', 'always'],

      // TypeScript
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-use-before-define': ['error', { variables: false, functions: false, classes: false }],
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',

      // Import
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/no-duplicates': 'error',
      'import/no-named-as-default-member': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal'],
          pathGroups: [{ pattern: 'react', group: 'external', position: 'before' }],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],

      // React
      'react/react-in-jsx-scope': 'off',
      'react/jsx-key': 'error',
      'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
      'react/jsx-no-useless-fragment': 'error',
      'react-refresh/only-export-components': 'warn',
      'react/prop-types': 'off',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'ignore' }],
      'react/self-closing-comp': ['error'],
    },
  },
]
