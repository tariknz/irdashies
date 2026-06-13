// irDashies SHM test producer.
//
// Standalone validation tool for the cross-process GPU texture pipeline.
// Renders an animated pattern (CPU-generated) into a shared D3D11 texture,
// signals a shared fence, and publishes handles + metadata to shared memory.
// The OpenXR layer (consumer) picks it up and draws it on the quad.
//
// This stands in for the real Electron producer so the transport can be
// validated without the app. Run it, then launch any OpenXR D3D11 app.

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX

#include <windows.h>
#include <d3d11_4.h>
#include <dxgi1_2.h>

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

#include "irdashies_shm.h"

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

static constexpr uint32_t kWidth = 512;
static constexpr uint32_t kHeight = 512;

template <typename T>
static void release(T*& p) {
  if (p) {
    p->Release();
    p = nullptr;
  }
}

int main() {
  // --- D3D11 device (BGRA support for typical UI textures) ---
  ID3D11Device* device = nullptr;
  ID3D11DeviceContext* context = nullptr;
  D3D_FEATURE_LEVEL fl = D3D_FEATURE_LEVEL_11_1;
  HRESULT hr = D3D11CreateDevice(
      nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION, &device,
      &fl, &context);
  if (FAILED(hr)) {
    printf("D3D11CreateDevice failed: 0x%08lx\n", hr);
    return 1;
  }

  ID3D11Device5* device5 = nullptr;
  ID3D11DeviceContext4* context4 = nullptr;
  device->QueryInterface(IID_PPV_ARGS(&device5));
  context->QueryInterface(IID_PPV_ARGS(&context4));
  if (!device5 || !context4) {
    printf("ID3D11Device5 / Context4 unavailable (need Win10 fences)\n");
    return 1;
  }

  // --- adapter LUID ---
  int64_t luid = 0;
  {
    IDXGIDevice* dxgiDevice = nullptr;
    IDXGIAdapter* adapter = nullptr;
    if (SUCCEEDED(device->QueryInterface(IID_PPV_ARGS(&dxgiDevice))) &&
        SUCCEEDED(dxgiDevice->GetAdapter(&adapter))) {
      DXGI_ADAPTER_DESC desc{};
      adapter->GetDesc(&desc);
      luid = (int64_t)((uint64_t)desc.AdapterLuid.HighPart << 32 |
                       (uint32_t)desc.AdapterLuid.LowPart);
    }
    release(adapter);
    release(dxgiDevice);
  }

  // --- shared texture (BGRA8, shader-resource + NT-handle shared) ---
  D3D11_TEXTURE2D_DESC td{};
  td.Width = kWidth;
  td.Height = kHeight;
  td.MipLevels = 1;
  td.ArraySize = 1;
  td.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  td.SampleDesc.Count = 1;
  td.Usage = D3D11_USAGE_DEFAULT;
  td.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  td.MiscFlags = D3D11_RESOURCE_MISC_SHARED_NTHANDLE | D3D11_RESOURCE_MISC_SHARED;
  ID3D11Texture2D* texture = nullptr;
  hr = device->CreateTexture2D(&td, nullptr, &texture);
  if (FAILED(hr)) {
    printf("CreateTexture2D failed: 0x%08lx\n", hr);
    return 1;
  }

  HANDLE textureHandle = nullptr;
  {
    IDXGIResource1* res = nullptr;
    if (SUCCEEDED(texture->QueryInterface(IID_PPV_ARGS(&res)))) {
      res->CreateSharedHandle(nullptr, DXGI_SHARED_RESOURCE_READ, nullptr,
                              &textureHandle);
    }
    release(res);
  }
  if (!textureHandle) {
    printf("CreateSharedHandle (texture) failed\n");
    return 1;
  }

  // --- shared fence ---
  ID3D11Fence* fence = nullptr;
  hr = device5->CreateFence(0, D3D11_FENCE_FLAG_SHARED, IID_PPV_ARGS(&fence));
  if (FAILED(hr)) {
    printf("CreateFence failed: 0x%08lx\n", hr);
    return 1;
  }
  HANDLE fenceHandle = nullptr;
  fence->CreateSharedHandle(nullptr, GENERIC_ALL, nullptr, &fenceHandle);
  if (!fenceHandle) {
    printf("CreateSharedHandle (fence) failed\n");
    return 1;
  }

  // --- shared memory + mutex ---
  HANDLE mapping = CreateFileMappingW(INVALID_HANDLE_VALUE, nullptr,
                                      PAGE_READWRITE, 0,
                                      sizeof(IrdashiesShmHeader),
                                      IRDASHIES_SHM_MAPPING_NAME);
  if (!mapping) {
    printf("CreateFileMapping failed: %lu\n", GetLastError());
    return 1;
  }
  auto* shm = (IrdashiesShmHeader*)MapViewOfFile(mapping, FILE_MAP_WRITE, 0, 0,
                                                 sizeof(IrdashiesShmHeader));
  if (!shm) {
    printf("MapViewOfFile failed: %lu\n", GetLastError());
    return 1;
  }
  HANDLE mutex = CreateMutexW(nullptr, FALSE, IRDASHIES_SHM_MUTEX_NAME);

  // --- static header fields ---
  ZeroMemory(shm, sizeof(*shm));
  shm->magic = IRDASHIES_SHM_MAGIC;
  shm->version = IRDASHIES_SHM_VERSION;
  shm->feederProcessId = GetCurrentProcessId();
  shm->adapterLuid = luid;
  shm->textureHandle = (uint64_t)(uintptr_t)textureHandle;
  shm->fenceHandle = (uint64_t)(uintptr_t)fenceHandle;
  shm->width = kWidth;
  shm->height = kHeight;
  shm->format = (uint32_t)DXGI_FORMAT_B8G8R8A8_UNORM;
  shm->posePosition[0] = 0.0f;
  shm->posePosition[1] = 0.0f;
  shm->posePosition[2] = -1.5f;
  shm->poseOrientation[0] = 0.0f;
  shm->poseOrientation[1] = 0.0f;
  shm->poseOrientation[2] = 0.0f;
  shm->poseOrientation[3] = 1.0f;
  shm->quadSizeMeters[0] = 0.5f;
  shm->quadSizeMeters[1] = 0.5f;

  printf("Producer running. PID=%u  texHandle=0x%llx  fenceHandle=0x%llx\n",
         shm->feederProcessId, (unsigned long long)shm->textureHandle,
         (unsigned long long)shm->fenceHandle);
  printf("Publishing %ux%u BGRA. Ctrl+C to stop.\n", kWidth, kHeight);

  std::vector<uint32_t> pixels(kWidth * kHeight);
  uint64_t fenceValue = 0;
  uint64_t frame = 0;

  for (;;) {
    // Animated pattern: gradient + a moving diagonal stripe. Distinct from the
    // layer's own fallback pulse so we know the texture actually crossed over.
    float phase = (float)(frame % 240) / 240.0f;
    int stripe = (int)(phase * (kWidth + kHeight));
    for (uint32_t y = 0; y < kHeight; ++y) {
      for (uint32_t x = 0; x < kWidth; ++x) {
        uint8_t r = (uint8_t)(255 * x / kWidth);
        uint8_t g = (uint8_t)(255 * y / kHeight);
        uint8_t b = 64;
        if (std::abs((int)(x + y) - stripe) < 24) {
          r = g = b = 255;  // bright diagonal band sweeps across
        }
        // BGRA8: 0xAARRGGBB in memory little-endian -> B,G,R,A bytes
        pixels[y * kWidth + x] =
            (0xFFu << 24) | ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
      }
    }

    context->UpdateSubresource(texture, 0, nullptr, pixels.data(), kWidth * 4,
                               0);
    ++fenceValue;
    context4->Signal(fence, fenceValue);
    context->Flush();

    if (mutex) WaitForSingleObject(mutex, INFINITE);
    shm->fenceValue = fenceValue;
    shm->frameNumber = ++frame;
    shm->flags |= IRDASHIES_SHM_FLAG_FEEDER_ATTACHED;
    if (mutex) ReleaseMutex(mutex);

    Sleep(16);
  }

  // (unreachable in this PoC; OS reclaims handles on exit)
  return 0;
}
