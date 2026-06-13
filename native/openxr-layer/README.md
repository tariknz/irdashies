# irDashies OpenXR Layer (PoC)

Proof-of-concept OpenXR **implicit API layer**. Injects into any OpenXR app,
hooks `xrEndFrame`, and draws one animated solid-color quad ~1.5 m in front of
the user. No texture sharing, no Electron, no SHM — this only proves the
injection + composition-layer mechanism works.

See `../../vr-openxr-design.md` for the full design and where this fits.

## What it does

- Registers as an implicit API layer (loader calls
  `irDashies_xrNegotiateLoaderApiLayerInterface`).
- On `xrCreateSession`, grabs the app's D3D11 device, creates a `LOCAL`
  reference space and a 512×512 quad swapchain.
- On `xrEndFrame`, clears the swapchain image to an animated blue (pulses via
  `displayTime` so you can tell it's live), then appends an
  `XrCompositionLayerQuad` to the app's layer list before calling the real
  `xrEndFrame`.

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

1. Build + register.
2. Launch the OpenXR app.
3. Expect a pulsing blue square floating ~1.5 m ahead.
4. Confirm load even without a headset: after launching any OpenXR app, check
   `%TEMP%\irdashies-openxr-layer.log` — it logs negotiate / instance / session
   stages. Also set `XR_LOADER_DEBUG=all` to see the loader list the layer.

## Status / limitations

- **Compiles and exports correctly; runtime not yet validated on a headset.**
- Single global session state (no multi-session / multi-instance handling).
- Clears via the app's **immediate** D3D11 context — fine for a PoC, but a real
  build should use its own device/context to avoid clobbering app pipeline
  state (OpenKneeboard does this).
- Not gated to iRacing yet — loads into every OpenXR app while registered.
  Process-name gating is a later step (see design doc).
- Quad pose/size are hardcoded.
