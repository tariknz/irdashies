import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import storybook from 'eslint-plugin-storybook';

const eslintReactRecommended = eslintReact.configs['recommended-typescript'];
const eslintReactErrorRules = Object.fromEntries(
  Object.entries(eslintReactRecommended.rules).filter(
    ([, severity]) => severity === 'error' || severity === 2
  )
);

// Architectural boundary: prevent cross-imports between frontend and app
const FRONTEND_NO_APP_IMPORTS = {
  group: ['**/app/**', '../app/**', '../../app/**'],
  message:
    'Frontend code cannot import from app/. Use IPC bridges and import types from @irdashies/types instead.',
};

// Enforce context namespace: imports from context subdirectories must go via @irdashies/context
const FRONTEND_CONTEXT_VIA_ALIAS = {
  group: ['**/context/**'],
  message:
    "Import from '@irdashies/context' instead of importing context internals directly.",
};

export default defineConfig([
  {
    ignores: [
      '**/.vite/**',
      '**/out/**',
      '**/coverage/**',
      'storybook-static/**',
      '**/dist/**',
      '**/.remember/**',
    ],
  },
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    ...eslintReactRecommended,
    files: ['src/frontend/**/*.{ts,tsx}', 'site/src/**/*.{ts,tsx}'],
    rules: {
      ...eslintReactErrorRules,
      // Preserve dependency checking from react-hooks/recommended-latest.
      '@eslint-react/exhaustive-deps': 'error',
      // These rules are substantially broader than their previous counterparts
      // and require application refactors outside this dependency migration.
      '@eslint-react/no-nested-component-definitions': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      // Registry-selected components have stable identities, but this rule
      // reports them as components created during render.
      '@eslint-react/static-components': 'off',
    },
  },
  storybook.configs['flat/recommended'],
  {
    files: ['**/*.stories.tsx'],
    rules: {
      // Storybook render functions are component-like but intentionally lowercase.
      '@eslint-react/rules-of-hooks': 'off',
    },
  },
  // Frontend import boundaries. In flat config a later block that sets
  // no-restricted-imports replaces the earlier one for overlapping files, so
  // each block lists every pattern that applies to its files.
  {
    files: ['src/frontend/**/*.{ts,tsx}'],
    ignores: ['src/frontend/components/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [FRONTEND_NO_APP_IMPORTS] },
      ],
    },
  },
  {
    files: ['src/frontend/**/*.{ts,tsx}'],
    ignores: [
      'src/frontend/context/**',
      'src/frontend/components/**/*.stories.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [FRONTEND_NO_APP_IMPORTS, FRONTEND_CONTEXT_VIA_ALIAS] },
      ],
    },
  },
  {
    files: ['src/frontend/components/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [FRONTEND_CONTEXT_VIA_ALIAS] },
      ],
    },
  },
  // Disallow console.* — use logger utilities instead
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/frontend/utils/logger.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/webserver/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/frontend/**', '../frontend/**', '../../frontend/**'],
              message:
                'App code cannot import from frontend/. Use IPC bridges and import types from @irdashies/types instead.',
            },
            {
              group: ['@irdashies/utils/*', '@irdashies/context'],
              message:
                'App code cannot import frontend aliases. Use IPC bridges and import types from @irdashies/types instead.',
            },
          ],
        },
      ],
    },
  },
]);
