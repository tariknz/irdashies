// irDashies OpenXR shared-memory contract.
//
// This header is the SINGLE source of truth shared by:
//   - the producer (app side: writes the texture + metadata)
//   - the consumer (OpenXR API layer: reads + composites into the headset)
//
// Both binaries MUST be built from the same version of this header. The
// mapping/mutex names are versioned; bump IRDASHIES_SHM_VERSION (and the
// names) on any incompatible layout change so an old consumer never
// misreads a new producer's bytes.
//
// MVP: a single quad / single shared texture. The struct is laid out so a
// per-widget layer array can be appended later without moving existing fields.

#pragma once

#include <cstdint>

#define IRDASHIES_SHM_MAPPING_NAME L"Local\\irdashies-openxr-shm-v1"
#define IRDASHIES_SHM_MUTEX_NAME L"Local\\irdashies-openxr-shm-v1.mutex"

#define IRDASHIES_SHM_MAGIC 0x31445249u  // 'IRD1'
#define IRDASHIES_SHM_VERSION 1u

// flags
#define IRDASHIES_SHM_FLAG_FEEDER_ATTACHED 0x1u

#pragma pack(push, 8)
struct IrdashiesShmHeader {
  uint32_t magic;    // IRDASHIES_SHM_MAGIC once initialised
  uint32_t version;  // IRDASHIES_SHM_VERSION
  uint64_t frameNumber;  // monotonic; 0 = nothing published yet
  uint32_t feederProcessId;  // producer PID (consumer DuplicateHandle's from it)
  uint32_t flags;            // IRDASHIES_SHM_FLAG_*
  int64_t adapterLuid;       // producer GPU LUID; consumer must match adapter

  // Shared GPU resources. These HANDLE values are valid in the PRODUCER
  // process only - the consumer must DuplicateHandle() from feederProcessId
  // before OpenSharedResource1 / OpenSharedFence.
  uint64_t textureHandle;  // NT handle to a shared D3D11 texture
  uint64_t fenceHandle;    // NT handle to a shared D3D11 fence
  uint64_t fenceValue;     // consumer waits for fence >= this before reading

  uint32_t width;
  uint32_t height;
  uint32_t format;  // DXGI_FORMAT of the shared texture
  // Bumped by the producer to request the consumer recenter the quad to the
  // current head pose. The consumer recenters when this value changes.
  uint32_t recenterCounter;

  // Quad placement in the LOCAL reference space (app controls it).
  float posePosition[3];     // metres
  float poseOrientation[4];  // quaternion x,y,z,w
  float quadSizeMeters[2];   // width,height in metres
};
#pragma pack(pop)
