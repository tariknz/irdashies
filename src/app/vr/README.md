# VR overlay producer (Electron side)

Feeds Electron offscreen-rendered frames to the OpenXR layer via shared memory.
This is the real producer that replaces `native/shm-test-producer`.

```
hidden OSR BrowserWindow (useSharedTexture)
  └ 'paint' event → GPU shared texture handle
       └ vr_overlay native addon (src/app/vr/native/vr_overlay.cc)
            └ open texture, copy into our shared texture, signal fence
                 └ publish over shared memory (native/shared/irdashies_shm.h)
                      └ OpenXR layer composites it as a quad
```

## Pieces

- `native/vr_overlay.cc` — Node addon (built by the root `binding.gyp`, target
  `vr_overlay`). `start` / `submitFrame` / `setPose` / `stop`.
- `native/index.js` + `index.d.ts` — typed loader (bundled by the vite main
  plugin, same mechanism as the irsdk addon).
- `vrOverlay.ts` — creates the offscreen window, pumps `paint` frames into the
  addon, manages lifecycle.

## Run (experimental, opt-in)

The OpenXR layer must be built + registered first (see
`native/openxr-layer`). Then:

```pwsh
$env:IRDASHIES_VR = "1"
npm start
```

Launch iRacing (OpenXR) and the overlay should appear on the quad. The addon is
rebuilt against Electron automatically by electron-forge on `npm start` /
`npm run make`.

## Status / limitations

- Compiles (node + ClangCL) and typechecks. **Not yet validated end to end on a
  headset.**
- Single offscreen window → single quad. Per-widget windows + per-widget quads
  and per-display mapping are follow-ups.
- The offscreen window loads the same renderer as the desktop overlay; display/
  widget filtering for the OSR surface is not handled yet.
- Pose is hardcoded (`DEFAULT_POSE`); settings-driven pose is a follow-up.
