// Import from JS so that we can type the API in a nicer way (without aliases)
// The alternative would be to somehow get types generated, or use aliases to
// fake a module and then define that module... but those are gross, so no thanks
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const NativeSDK = require('../build/Release/irsdk_node.node').iRacingSdkNode;
// @todo For some reason this is not being built when being downloaded. It runs via prepack, but not in the built version.
// export const DebugSDK = require("../build/Debug/irsdk_node.node").iRacingSdkNode;
