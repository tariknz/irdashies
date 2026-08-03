// Import from JS so that we can type the API in a nicer way (without aliases)
// The alternative would be to somehow get types generated, or use aliases to
// fake a module and then define that module... but those are gross, so no thanks
import { createRequire } from 'node:module';

const nativeRequire = createRequire(import.meta.url);

const nativeModule = process.env.IRDASHIES_TELEMETRY_REPLAY
  ? nativeRequire('../build/Release/irsdk_tape_node.node')
  : process.env.IRDASHIES_IRSDK_REPLAY === '1'
    ? nativeRequire('../build/Release/irsdk_node_replay.node')
    : nativeRequire('../build/Release/irsdk_node.node');

export const NativeSDK = nativeModule.iRacingSdkNode;
// @todo For some reason this is not being built when being downloaded. It runs via prepack, but not in the built version.
// export const DebugSDK = require("../build/Debug/irsdk_node.node").iRacingSdkNode;
