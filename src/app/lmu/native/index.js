// Loader shim for the LMU shared-memory addon. Mirrors index.js in the
// parent native/ folder: the bundler resolves '../build/Release/*.node'
// relative to the output .vite/build/ dir.
//
// IRDASHIES_LMU_REPLAY selects the replay build. That addon is the same
// lmu_node.cc compiled against a tape-backed source instead of the live
// shared-memory one, so a recording goes through the real snapshot-to-JS
// conversion rather than a stand-in for it. See lmu_source.h.
const nativeModule = process.env.IRDASHIES_LMU_REPLAY
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../build/Release/lmu_tape_node.node')
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../build/Release/lmu_node.node');

export const NativeLmu = nativeModule.LmuSdkNode;
