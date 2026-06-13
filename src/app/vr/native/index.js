/* eslint-disable @typescript-eslint/no-require-imports */
// Loads the vr_overlay native addon. Mirrors the irsdk native loader: the path
// here is matched by basename by the vite main-process plugin, which rewrites
// the import and copies the .node into the bundle. See vite.main.config.ts.
export const VrOverlayNative =
  require('../build/Release/vr_overlay.node').vrOverlay;
