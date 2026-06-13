# irDashies OpenXR Layer (PoC)

OpenXR **implicit API layer**. Injects into any OpenXR D3D11 app, hooks
`xrEndFrame`, and renders a composition-layer quad into the headset.

It reads a shared D3D11 texture published by a producer over shared memory
(`../shared/irdashies_shm.h`) and shader-blits it onto the quad. If no producer
is running it falls back to an animated solid color, so there is always visible
feedback. Electron is not wired in yet — use the test producer in
`../shm-test-producer` as the texture source.

See `../../vr-openxr-design.md` for the full design and where this fits.

## What it does

- Registers as an implicit API layer (loader calls
  `irDashies_xrNegotiateLoaderApiLayerInterface`).
- On `xrCreateSession`, grabs the app's D3D11 device (+ `Device1`/`Device5`/
  `Context4`), creates a `LOCAL` reference space and a fullscreen-triangle blit
  pipeline.
- On `xrEndFrame`:
  - reads the latest producer frame from shared memory;
  - duplicates the producer's texture + fence handles into the game process,
    opens them (`OpenSharedResource1` / `OpenSharedFence`);
  - sizes the quad swapchain to the texture, waits on the shared fence, and
    blits the texture into the swapchain image;
  - appends an `XrCompositionLayerQuad` (pose/size from the producer) to the
    app's layer list before calling the real `xrEndFrame`.
- No producer → animated blue pulse fallback.

## Build

Requires CMake ≥ 3.22, Visual Studio 2022 (C++), and git (for FetchContent of
the OpenXR-SDK headers).

```pwsh
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --target irDashiesOpenXRLayer
```

Outputs:

- `build/Release/irDashies-OpenXR-Layer.dll` — the layer
- `build/Release/irDashies-OpenXR.json` — the manifest (absolute DLL path baked in)

## Register / unregister (needs admin)

Implicit layers live under `HKLM\SOFTWARE\Khronos\OpenXR\1\ApiLayers\Implicit`.
The scripts self-elevate.

```pwsh
pwsh -File scripts/register.ps1      # enable
pwsh -File scripts/unregister.ps1    # disable + remove
```

Temporarily disable without unregistering:

```pwsh
$env:DISABLE_IRDASHIES_OPENXR = "1"
```

## Test

Any OpenXR D3D11 app works. Easiest sanity check is Khronos `hello_xr`
(D3D11 graphics plugin) or iRacing with OpenXR selected in the launcher.

1. Build + register the layer.
2. Build + run the test producer (`../shm-test-producer`):
   `build/Release/irdashies-shm-test-producer.exe`.
3. Launch the OpenXR app.
4. Expect a 0.5 m quad ~1.5 m ahead showing the producer's animated
   gradient + sweeping diagonal band. Stop the producer → it switches to the
   blue pulse fallback.
5. Confirm load even without a headset: check
   `%TEMP%\irdashies-openxr-layer.log` (negotiate / session / shared-memory
   stages). `XR_LOADER_DEBUG=all` makes the loader list the layer.

The cross-process GPU path itself can be validated without a headset using
`irdashies-shm-probe` (see `../shm-test-producer`).

## Status / limitations

- Builds + exports correctly. Cross-process texture/fence transport validated
  headless (probe). **In-headset blit not yet confirmed on a real runtime.**
- Single global session state (no multi-session / multi-instance handling).
- Uses the app's **immediate** D3D11 context — fine for now, but a real build
  should use its own device/context to avoid clobbering app pipeline state
  (OpenKneeboard does this).
- Not gated to iRacing yet — loads into every OpenXR app while registered.
  Process-name gating is a later step (see design doc).
- Single quad only; per-widget atlas + multiple quads come later.
