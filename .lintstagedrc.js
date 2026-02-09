module.exports = {
  // Format and lint JS/TS files
  '*.{js,jsx,ts,tsx}': ['prettier --write', 'eslint --fix --max-warnings 0'],
  // Format other files
  '*.{json,css,md}': ['prettier --write'],
};
