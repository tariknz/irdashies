# irDashies SHM Test Producer

Standalone tools to validate the producer→consumer GPU texture pipeline without
the Electron app or a headset. Stands in for the real Electron producer.

- **`irdashies-shm-test-producer`** — creates a shared D3D11 texture + fence,
  renders an animated pattern (gradient + sweeping diagonal band) into it, and
  publishes the handles + metadata to shared memory (`../shared/irdashies_shm.h`).
- **`irdashies-shm-probe`** — a separate process that opens the shared memory,
  duplicates the producer's handles, opens the shared texture + fence, waits on
  the fence, copies the texture to a CPU-readable staging texture, and reads
  back pixels. Proves the cross-process GPU path end to end.

## Build

```pwsh
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

## Validate the transport (no headset)

```pwsh
# terminal 1
build/Release/irdashies-shm-test-producer.exe
# terminal 2
build/Release/irdashies-shm-probe.exe
```

Expect the probe to print `PASS: cross-process GPU texture transport works.`
with sampled pixels matching the producer pattern.

## Use with the OpenXR layer (headset)

Run the producer, then launch any OpenXR D3D11 app with the layer registered
(see `../openxr-layer`). The quad should show the producer's animated pattern.

## Notes

- Texture is 512×512 `B8G8R8A8_UNORM`, opaque.
- Quad pose is hardcoded ~1.5 m ahead; the real producer will drive pose from
  widget settings.
- This is a test harness, not shipped code.
