import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },

  /** Browser application, type-aware through the frontend project. */
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ['./frontend/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...sharedRules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  /** Signaling server, type-aware through the server project. */
  {
    files: ['server/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ['./server/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: sharedRules,
  },

  /** Tooling configs are in neither project, so they are linted without types. */
  {
    files: ['eslint.config.js', 'frontend/vite.config.ts', 'frontend/vitest.config.ts', 'server/vitest.config.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
