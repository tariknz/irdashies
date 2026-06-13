# irDashies Native VR via OpenXR (caveman)

How render irDashies widgets into VR headset native. No OpenKneeboard needed. Caveman style. Substance full, fluff dead.

Reference impl = OpenKneeboard (`../../cpp/openkneeboard`). See `vr-website-rendering.md` for how it work. This doc = how port to irDashies.

## Decisions Locked

- **Backend = OpenXR API layer.** Inject into game, hook `xrEndFrame`, staple quads onto frame. Same as OpenKneeboard main path. (NOT OpenVR/SteamVR overlay.)
- **Layout = one quad per widget.** Each widget own 3D pose. Independent placement. Map to OpenKneeboard `mLayers[]` model.
- **Target = iRacing only.** iRacing native OpenXR since 2022 S3. D3D11 only. Skip D3D12/Vulkan subclasses.

## Why Feasible

- **Producer texture free.** Electron 35 `webPreferences.offscreen.useSharedTexture` → `paint` event give D3D11 shared NT handle, zero CPU copy. Same as OpenKneeboard CEF `OnAcceleratedPaint`.
- **C++ pipeline exist.** Repo already build native addon (`binding.gyp` + `node-addon-api` for `irsdk_node`). Adding native code not new ground.

## Big Picture

```
[irDashies app process]                          [iRacing.exe + injected OpenXR layer]
 hidden OSR BrowserWindow per widget               implicit API layer DLL
  └ paint event → D3D11 shared texture handle        └ hooks xrEndFrame
       └ native addon (producer)                          └ reads SHM
            └ composite N widgets → 1 atlas texture            └ DuplicateHandle from producer PID
                 └ SHM::Writer ──shared handle + fence──►          └ open shared texture on game device
                                                                        └ N XrCompositionLayerQuad (one per widget)
                                                                             └ call real xrEndFrame, extended list
```

Widgets NOT rendered in VR direct. Rendered offscreen to texture in app. Shared cross-process to GPU. Game-side layer staple each as quad in 3D space.

## Two Artifacts, Two Toolchains

CRITICAL: ship TWO native binaries. Talk over SHM. Must agree on one versioned SHM struct (shared header).

|          | Producer                                 | Consumer                               |
| -------- | ---------------------------------------- | -------------------------------------- |
| Lives in | Electron main process                    | injected into iRacing.exe              |
| Form     | node addon (N-API)                       | plain Win32 DLL (OpenXR API layer)     |
| Build    | existing node-gyp / `binding.gyp`        | NEW — CMake/MSBuild, no node, no N-API |
| Job      | OSR texture → atlas → SHM writer + fence | hook xrEndFrame, read SHM → N quads    |

Consumer CANNOT be node addon. No Node runtime in game process. New build pipeline in repo. Version SHM name (like OpenKneeboard `com.fredemmott.openkneeboard/v{ver}-s{size}`) or producer/consumer desync. Ship both same release.

## Stage 1 — Widget → Texture (app process)

- Hidden OSR `BrowserWindow` per VR widget. `webPreferences.offscreen.useSharedTexture = true`.
- `paint` event give `texture.textureInfo.sharedTextureHandle` = D3D11 shared NT handle on Windows.
- WARNING: only limited textures alive at once. Call `texture.release()` ASAP. CVE = use-after-free in `release()` callback (GHSA-8x5q-pvf5-64mp). Manage lifetime careful in main process.
- One OSR surface per widget = clean per-widget quad mapping.

## Stage 2 — Composite + Write SHM (producer addon)

- Addon create own D3D11 device. Open each widget shared handle via `OpenSharedResource1`.
- Composite N widget textures → ONE atlas texture (each widget = sub-rect). Triple-buffered.
- Format fixed: `DXGI_FORMAT_B8G8R8A8_UNORM`, premultiplied alpha.
- Signal D3D11 fence after copy.
- SHM::Writer write: atlas texture HANDLE + fence HANDLE + producer PID + per-widget `LayerConfig` (pose, physical size meters, source rect, opacity).
- SHM = ring buffer, ~3 frames.
- Atlas pack step lives HERE (separate OSR surfaces → one shared texture). Keeps consumer simple = one shared texture like OpenKneeboard.

## Stage 3 — Inject as OpenXR API Layer (game process)

- DLL = implicit API layer. Export `irDashies_xrNegotiateLoaderApiLayerInterface`. JSON manifest (name, library_path, disable_environment, functions).
- Registry: `HKLM\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit\{json_path}` = DWORD 0 (enabled).
- Hook `xrGetInstanceProcAddr`. Intercept chosen funcs. Rest → `Next()`.
- **GATE TO iRACING.** Check `GetModuleFileName` for `iRacingSim64DX11.exe` in `xrCreateInstance`/`xrCreateSession`. Not iRacing → every hooked call pure pass-through. Layer vanish for all other games. Turns "break any VR game" into "only touch iRacing." Big risk cut vs OpenKneeboard (which inject everywhere).
- `xrCreateSession` sniff graphics binding = `XrGraphicsBindingD3D11KHR` → D3D11 path only.
- Create SHM::Reader on game GPU device.

## Stage 4 — Inject Each Frame: xrEndFrame

Per frame:

1. Read SHM frame. No frame → pass through untouched.
2. Open producer texture: `OpenProcess(PROCESS_DUP_HANDLE)` on producer PID → `DuplicateHandle` → `OpenSharedResource1`. (Shared NT handles not named, must duplicate cross-process. LUID check = same GPU.)
3. Create/resize quad swapchain to atlas size.
4. `GetHMDPose` = `xrLocateSpace` view-space vs LOCAL-space.
5. Per widget build `XrCompositionLayerQuad`: pose, physical size, opacity, sub-image rect into atlas, LOCAL reference space, alpha-blend bit.
6. Acquire → Wait → render sprites into swapchain image (fence-synced, `ctx->Wait` on producer fence) → Release.
7. Append OK quads to game layer array. Call real `xrEndFrame` extended list. Respect max layer count.

## Cross-Process Magic

- **Texture**: DXGI shared NT handle (`D3D11_RESOURCE_MISC_SHARED_NTHANDLE`). Consumer `DuplicateHandle` from producer PID, then `OpenSharedResource1`. Zero-copy GPU-to-GPU same adapter.
- **Sync**: D3D11 fence handle shared. Producer signal, consumer wait. No tearing.
- **Metadata**: shared memory ring (poses, sizes, layer config, producer PID).
- **Rendezvous**: named FileMapping + named Mutex. Versioned name. Consumer open at startup; absent → no producer.

## Hard Parts (real cost — not SHM plumbing)

SHM/texture/fence mechanics = well-trodden, OpenKneeboard = reference. Real cost here:

1. **Positioning UX.** Per-widget quad need 3D pose each. 2D settings panel with XYZ/euler = miserable in headset. Real fix = in-headset reposition (gaze or motion controller grab) → add OpenXR action sets / input to layer = big extra work beyond rendering. MVP = numeric config + "recenter to head pose" button. Dominates UX quality. **DECIDE SCOPE.**
2. **Install / elevation / registry.** Implicit layer = write HKLM → needs admin → separate elevated helper exe + UAC. Enable/disable. `disable_environment` var (turn off no uninstall). Clean removal on uninstall. Support-burden surface.
3. **iRacing gate** (above) = main risk mitigation. Do it.
4. **Testing.** Injected DLL = no unit test, Storybook useless. Build tiny standalone OpenXR host harness (render quad from SHM) to validate layer without launching iRacing each iteration. Budget for it.
5. **Handle duplication** = same-user, same-GPU only. Producer publish PID in SHM. Laptop iGPU+dGPU = LUID mismatch care.

## Phasing

1. Producer addon: OSR shared texture → D3D11 atlas → SHM writer + fence. Validate with test harness.
2. Consumer layer: negotiate, gate-to-iRacing, hook xrEndFrame, single static quad. Prove frame reach headset.
3. N-layer atlas + per-widget config (numeric poses first).
4. Install/registry helper + enable/disable + uninstall cleanup.
5. In-headset reposition (action sets). UX payoff. Deferrable.

## Open Questions (decide before code)

- In-headset positioning in scope, or numeric-config MVP first? (biggest effort lever)
- Desktop overlay run simultaneous with VR, or VR-mode swap window to OSR-only? (double render cost vs mode switch)
- Consumer DLL location/build in repo — new `native/openxr-layer` with CMake alongside existing addon?

## Risk Notes

- Electron OSR shared-texture = "advanced" feature, needs native module, had use-after-free CVE in `release()`. Lifetime care.
- OSR run widget SEPARATE from on-screen window. Run both = double cost, or switch fully to OSR.
- Adapter/LUID match: producer + consumer same GPU. Single-GPU fine; laptop iGPU+dGPU = care.

## Sources

- Electron Offscreen Rendering: https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
- OffscreenSharedTexture structure: https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture
- Shared-texture OSR PR: https://github.com/electron/electron/pull/42953
- Electron use-after-free advisory: https://github.com/electron/electron/security/advisories/GHSA-8x5q-pvf5-64mp
- iRacing VR/OpenXR: https://support.iracing.com/support/solutions/articles/31000173566-what-you-need-to-play-iracing-in-vr
- OpenKneeboard reference: `../../cpp/openkneeboard`, `vr-website-rendering.md`
