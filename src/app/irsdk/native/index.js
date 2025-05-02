/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// Import from JS so that we can type the API in a nicer way (without aliases)
// The alternative would be to somehow get types generated, or use aliases to
// fake a module and then define that module... but those are gross, so no thanks
export const NativeSDK = require('../build/Release/irsdk_node.node').iRacingSdkNode;
// @todo For some reason this is not being built when being downloaded. It runs via prepack, but not in the built version.
// export const DebugSDK = require("../build/Debug/irsdk_node.node").iRacingSdkNode;
