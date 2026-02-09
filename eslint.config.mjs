import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";

export default defineConfig([
  { ignores: ['**/.vite/**', '**/out/**', '**/coverage/**'] },
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  { settings: { react: { version: 'detect' } } },
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  reactHooks.configs.flat['recommended-latest'],
  storybook.configs['flat/recommended'],
  // Architectural boundary: prevent cross-imports between frontend and app
  {
    files: ['src/frontend/**/*.{ts,tsx}'],
    ignores: ['src/frontend/components/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/app/**', '../app/**', '../../app/**'],
          message: 'Frontend code cannot import from app/. Use IPC bridges and import types from @irdashies/types instead.'
        }]
      }]
    }
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/webserver/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/frontend/**', '../frontend/**', '../../frontend/**'],
            message: 'App code cannot import from frontend/. Use IPC bridges and import types from @irdashies/types instead.'
          },
          {
            group: ['@irdashies/utils/*', '@irdashies/context'],
            message: 'App code cannot import frontend aliases. Use IPC bridges and import types from @irdashies/types instead.'
          }
        ]
      }]
    }
  }
]);