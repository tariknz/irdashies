// Loader shim for the LMU shared-memory addon. Mirrors index.js in the
// parent native/ folder: the bundler resolves '../build/Release/*.node'
// relative to the output .vite/build/ dir.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativeModule = require('../build/Release/lmu_node.node');

export const NativeLmu = nativeModule.LmuSdkNode;
