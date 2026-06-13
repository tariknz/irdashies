// irDashies SHM transport probe.
//
// Headless validation of the cross-process GPU path that the OpenXR layer uses
// (no headset needed). Runs as a SEPARATE process from the producer:
//   open SHM -> DuplicateHandle from feeder -> OpenSharedResource1 +
//   OpenSharedFence -> Wait(fence) -> CopyResource to a CPU-readable staging
//   texture -> read pixels.
// Prints whether it succeeded and a couple of sampled pixels.

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX

#include <windows.h>
#include <d3d11_4.h>

#include <cstdint>
#include <cstdio>

#include "irdashies_shm.h"

#pragma comment(lib, "d3d11.lib")

template <typename T>
static void release(T*& p) {
  if (p) {
    p->Release();
    p = nullptr;
  }
}

int main() {
  HANDLE mapping =
      OpenFileMappingW(FILE_MAP_READ, FALSE, IRDASHIES_SHM_MAPPING_NAME);
  if (!mapping) {
    printf("FAIL: producer not running (OpenFileMapping: %lu)\n",
           GetLastError());
    return 1;
  }
  HANDLE mutex = OpenMutexW(SYNCHRONIZE, FALSE, IRDASHIES_SHM_MUTEX_NAME);
  auto* shm = (const IrdashiesShmHeader*)MapViewOfFile(
      mapping, FILE_MAP_READ, 0, 0, sizeof(IrdashiesShmHeader));
  if (!shm) {
    printf("FAIL: MapViewOfFile: %lu\n", GetLastError());
    return 1;
  }

  IrdashiesShmHeader f{};
  if (mutex) WaitForSingleObject(mutex, INFINITE);
  f = *shm;
  if (mutex) ReleaseMutex(mutex);

  printf("SHM: magic=0x%08x version=%u frame=%llu feederPid=%u\n", f.magic,
         f.version, (unsigned long long)f.frameNumber, f.feederProcessId);
  printf("     tex=%ux%u format=%u fenceValue=%llu\n", f.width, f.height,
         f.format, (unsigned long long)f.fenceValue);
  if (f.magic != IRDASHIES_SHM_MAGIC || f.frameNumber == 0) {
    printf("FAIL: SHM not valid / no frame yet\n");
    return 1;
  }

  ID3D11Device* device = nullptr;
  ID3D11DeviceContext* context = nullptr;
  D3D_FEATURE_LEVEL fl;
  if (FAILED(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0,
                               nullptr, 0, D3D11_SDK_VERSION, &device, &fl,
                               &context))) {
    printf("FAIL: D3D11CreateDevice\n");
    return 1;
  }
  ID3D11Device1* device1 = nullptr;
  ID3D11Device5* device5 = nullptr;
  ID3D11DeviceContext4* context4 = nullptr;
  device->QueryInterface(IID_PPV_ARGS(&device1));
  device->QueryInterface(IID_PPV_ARGS(&device5));
  context->QueryInterface(IID_PPV_ARGS(&context4));

  HANDLE feeder = OpenProcess(PROCESS_DUP_HANDLE, FALSE, f.feederProcessId);
  if (!feeder) {
    printf("FAIL: OpenProcess(feeder %u): %lu\n", f.feederProcessId,
           GetLastError());
    return 1;
  }
  HANDLE dupTex = nullptr;
  HANDLE dupFence = nullptr;
  DuplicateHandle(feeder, (HANDLE)(uintptr_t)f.textureHandle,
                  GetCurrentProcess(), &dupTex, 0, FALSE, DUPLICATE_SAME_ACCESS);
  DuplicateHandle(feeder, (HANDLE)(uintptr_t)f.fenceHandle, GetCurrentProcess(),
                  &dupFence, 0, FALSE, DUPLICATE_SAME_ACCESS);
  CloseHandle(feeder);
  if (!dupTex || !dupFence) {
    printf("FAIL: DuplicateHandle (tex=%p fence=%p)\n", dupTex, dupFence);
    return 1;
  }

  ID3D11Texture2D* shared = nullptr;
  ID3D11Fence* fence = nullptr;
  if (FAILED(device1->OpenSharedResource1(dupTex, IID_PPV_ARGS(&shared)))) {
    printf("FAIL: OpenSharedResource1\n");
    return 1;
  }
  if (FAILED(device5->OpenSharedFence(dupFence, IID_PPV_ARGS(&fence)))) {
    printf("FAIL: OpenSharedFence\n");
    return 1;
  }
  printf("OK: opened shared texture + fence cross-process\n");

  context4->Wait(fence, f.fenceValue);

  D3D11_TEXTURE2D_DESC td{};
  shared->GetDesc(&td);
  td.Usage = D3D11_USAGE_STAGING;
  td.BindFlags = 0;
  td.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  td.MiscFlags = 0;
  ID3D11Texture2D* staging = nullptr;
  if (FAILED(device->CreateTexture2D(&td, nullptr, &staging))) {
    printf("FAIL: create staging\n");
    return 1;
  }
  context->CopyResource(staging, shared);
  context->Flush();

  D3D11_MAPPED_SUBRESOURCE m{};
  if (FAILED(context->Map(staging, 0, D3D11_MAP_READ, 0, &m))) {
    printf("FAIL: Map staging\n");
    return 1;
  }
  auto px = [&](uint32_t x, uint32_t y) -> uint32_t {
    auto* row = (const uint8_t*)m.pData + (size_t)y * m.RowPitch;
    return ((const uint32_t*)row)[x];
  };
  printf("OK: read back pixels: center=0x%08x corner=0x%08x\n",
         px(td.Width / 2, td.Height / 2), px(0, 0));
  context->Unmap(staging, 0);

  printf("\nPASS: cross-process GPU texture transport works.\n");
  return 0;
}
