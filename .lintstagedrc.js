export default {
  // Format and lint JS/TS files
  '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}': [
    'prettier --write',
    'eslint --fix --max-warnings 0',
  ],
  // Format other files
  '*.{css,md}': ['prettier --write'],
};
