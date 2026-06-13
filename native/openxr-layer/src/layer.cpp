// irDashies OpenXR API layer.
//
// Implicit API layer: injects into OpenXR D3D11 apps, hooks xrEndFrame, and
// renders a composition-layer quad into the headset.
//
// Stage 2 (this file): reads a shared D3D11 texture published by the producer
// over shared memory (see ../../shared/irdashies_shm.h), opens it on the game's
// device, waits on the shared fence, and shader-blits it onto the quad. If no
// producer is running it falls back to an animated solid color so there is
// always visible feedback.

#define XR_USE_GRAPHICS_API_D3D11
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX

#include <d3d11_4.h>
#include <d3dcompiler.h>

#include <openxr/openxr.h>
#include <openxr/openxr_platform.h>
// Loader<->API-layer negotiation types. Note: pre-1.0.33 SDKs called this
// header <openxr/loader_interfaces.h>; it was renamed in 1.0.33.
#include <openxr/openxr_loader_negotiation.h>

#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <string_view>
#include <vector>

#include "irdashies_shm.h"

// ---------------------------------------------------------------------------
// Logging (no debugger in an injected game process; log to a temp file)
// ---------------------------------------------------------------------------
static void layerLog(const char* fmt, ...) {
  char buf[1024];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);

  OutputDebugStringA("[irDashies-OpenXR] ");
  OutputDebugStringA(buf);
  OutputDebugStringA("\n");

  char path[MAX_PATH];
  if (GetTempPathA(MAX_PATH, path)) {
    strncat_s(path, MAX_PATH, "irdashies-openxr-layer.log", _TRUNCATE);
    FILE* f = nullptr;
    if (fopen_s(&f, path, "a") == 0 && f) {
      fprintf(f, "%s\n", buf);
      fclose(f);
    }
  }
}

template <typename T>
static void release(T*& p) {
  if (p) {
    p->Release();
    p = nullptr;
  }
}

// ---------------------------------------------------------------------------
// Next-in-chain dispatch table
// ---------------------------------------------------------------------------
static PFN_xrGetInstanceProcAddr g_nextGetInstanceProcAddr = nullptr;

static PFN_xrCreateSession g_next_xrCreateSession = nullptr;
static PFN_xrDestroySession g_next_xrDestroySession = nullptr;
static PFN_xrEndFrame g_next_xrEndFrame = nullptr;
static PFN_xrEnumerateSwapchainFormats g_next_xrEnumerateSwapchainFormats = nullptr;
static PFN_xrCreateSwapchain g_next_xrCreateSwapchain = nullptr;
static PFN_xrDestroySwapchain g_next_xrDestroySwapchain = nullptr;
static PFN_xrEnumerateSwapchainImages g_next_xrEnumerateSwapchainImages = nullptr;
static PFN_xrAcquireSwapchainImage g_next_xrAcquireSwapchainImage = nullptr;
static PFN_xrWaitSwapchainImage g_next_xrWaitSwapchainImage = nullptr;
static PFN_xrReleaseSwapchainImage g_next_xrReleaseSwapchainImage = nullptr;
static PFN_xrCreateReferenceSpace g_next_xrCreateReferenceSpace = nullptr;
static PFN_xrDestroySpace g_next_xrDestroySpace = nullptr;

// ---------------------------------------------------------------------------
// Shared-memory reader (producer -> consumer transport)
// ---------------------------------------------------------------------------
static HANDLE g_shmMapping = nullptr;
static HANDLE g_shmMutex = nullptr;
static const IrdashiesShmHeader* g_shm = nullptr;

static bool ensureShmOpen() {
  if (g_shm) return true;
  if (!g_shmMapping) {
    g_shmMapping =
        OpenFileMappingW(FILE_MAP_READ, FALSE, IRDASHIES_SHM_MAPPING_NAME);
    if (!g_shmMapping) return false;  // producer not running
  }
  if (!g_shmMutex) {
    g_shmMutex = OpenMutexW(SYNCHRONIZE, FALSE, IRDASHIES_SHM_MUTEX_NAME);
  }
  g_shm = (const IrdashiesShmHeader*)MapViewOfFile(
      g_shmMapping, FILE_MAP_READ, 0, 0, sizeof(IrdashiesShmHeader));
  if (g_shm) layerLog("Connected to producer shared memory.");
  return g_shm != nullptr;
}

static bool readShmFrame(IrdashiesShmHeader& out) {
  if (!ensureShmOpen()) return false;
  bool locked = false;
  if (g_shmMutex) {
    locked = (WaitForSingleObject(g_shmMutex, 8) == WAIT_OBJECT_0);
  }
  memcpy(&out, g_shm, sizeof(out));
  if (locked) ReleaseMutex(g_shmMutex);

  if (out.magic != IRDASHIES_SHM_MAGIC || out.version != IRDASHIES_SHM_VERSION) {
    return false;
  }
  if (!(out.flags & IRDASHIES_SHM_FLAG_FEEDER_ATTACHED)) return false;
  if (out.frameNumber == 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------
static constexpr uint32_t kFallbackSize = 512;

struct SessionState {
  XrSession session = XR_NULL_HANDLE;
  ID3D11Device* device = nullptr;
  ID3D11Device1* device1 = nullptr;
  ID3D11Device5* device5 = nullptr;
  ID3D11DeviceContext* context = nullptr;
  ID3D11DeviceContext4* context4 = nullptr;
  XrSpace localSpace = XR_NULL_HANDLE;

  // Quad swapchain (sized to the shared texture, or kFallbackSize).
  XrSwapchain swapchain = XR_NULL_HANDLE;
  int64_t swapchainFormat = 0;
  uint32_t width = 0;
  uint32_t height = 0;
  std::vector<ID3D11Texture2D*> images;
  std::vector<ID3D11RenderTargetView*> rtvs;

  // Fullscreen-triangle blit pipeline.
  ID3D11VertexShader* vs = nullptr;
  ID3D11PixelShader* ps = nullptr;
  ID3D11SamplerState* sampler = nullptr;

  // Shared producer resources (cached; reopened when producer identity changes).
  uint32_t feederPid = 0;
  uint64_t texHandleVal = 0;
  uint64_t fenceHandleVal = 0;
  ID3D11Texture2D* sharedTexture = nullptr;
  ID3D11ShaderResourceView* sharedSrv = nullptr;
  ID3D11Fence* fence = nullptr;
};
static SessionState g;

// ---------------------------------------------------------------------------
// Blit shaders
// ---------------------------------------------------------------------------
static const char kVS[] =
    "struct VSOut{float4 pos:SV_Position;float2 uv:TEXCOORD0;};"
    "VSOut main(uint id:SV_VertexID){"
    "  VSOut o;"
    "  float2 uv=float2((id<<1)&2,id&2);"
    "  o.uv=uv;"
    "  o.pos=float4(uv*float2(2,-2)+float2(-1,1),0,1);"
    "  return o;"
    "}";

static const char kPS[] =
    "Texture2D tex:register(t0);SamplerState smp:register(s0);"
    "float4 main(float4 pos:SV_Position,float2 uv:TEXCOORD0):SV_Target{"
    "  return tex.Sample(smp,uv);"
    "}";

static bool createBlitPipeline() {
  ID3DBlob* vsb = nullptr;
  ID3DBlob* psb = nullptr;
  ID3DBlob* err = nullptr;
  if (FAILED(D3DCompile(kVS, sizeof(kVS) - 1, "vs", nullptr, nullptr, "main",
                        "vs_5_0", 0, 0, &vsb, &err))) {
    layerLog("VS compile failed: %s", err ? (char*)err->GetBufferPointer() : "");
    release(err);
    return false;
  }
  if (FAILED(D3DCompile(kPS, sizeof(kPS) - 1, "ps", nullptr, nullptr, "main",
                        "ps_5_0", 0, 0, &psb, &err))) {
    layerLog("PS compile failed: %s", err ? (char*)err->GetBufferPointer() : "");
    release(err);
    release(vsb);
    return false;
  }
  HRESULT a = g.device->CreateVertexShader(vsb->GetBufferPointer(),
                                           vsb->GetBufferSize(), nullptr, &g.vs);
  HRESULT b = g.device->CreatePixelShader(psb->GetBufferPointer(),
                                          psb->GetBufferSize(), nullptr, &g.ps);
  release(vsb);
  release(psb);
  if (FAILED(a) || FAILED(b)) {
    layerLog("Create shader failed.");
    return false;
  }

  D3D11_SAMPLER_DESC sd{};
  sd.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
  sd.AddressU = sd.AddressV = sd.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  sd.ComparisonFunc = D3D11_COMPARISON_NEVER;
  sd.MaxLOD = D3D11_FLOAT32_MAX;
  return SUCCEEDED(g.device->CreateSamplerState(&sd, &g.sampler));
}

// ---------------------------------------------------------------------------
// Shared texture / fence management
// ---------------------------------------------------------------------------
static void closeSharedResources() {
  release(g.sharedSrv);
  release(g.sharedTexture);
  release(g.fence);
  g.feederPid = 0;
  g.texHandleVal = 0;
  g.fenceHandleVal = 0;
}

// Opens (or re-opens, if the producer changed) the shared texture + fence by
// duplicating the producer's handles into this process. Returns true if the
// shared resources are ready to use.
static bool ensureSharedResources(const IrdashiesShmHeader& f) {
  const bool same = g.sharedTexture && g.feederPid == f.feederProcessId &&
                    g.texHandleVal == f.textureHandle &&
                    g.fenceHandleVal == f.fenceHandle;
  if (same) return true;

  closeSharedResources();

  HANDLE feeder = OpenProcess(PROCESS_DUP_HANDLE, FALSE, f.feederProcessId);
  if (!feeder) {
    layerLog("OpenProcess(feeder %u) failed: %lu", f.feederProcessId,
             GetLastError());
    return false;
  }

  HANDLE dupTex = nullptr;
  HANDLE dupFence = nullptr;
  DuplicateHandle(feeder, (HANDLE)(uintptr_t)f.textureHandle,
                  GetCurrentProcess(), &dupTex, 0, FALSE, DUPLICATE_SAME_ACCESS);
  DuplicateHandle(feeder, (HANDLE)(uintptr_t)f.fenceHandle, GetCurrentProcess(),
                  &dupFence, 0, FALSE, DUPLICATE_SAME_ACCESS);
  CloseHandle(feeder);

  bool ok = false;
  if (dupTex && dupFence && g.device1 && g.device5) {
    if (SUCCEEDED(g.device1->OpenSharedResource1(
            dupTex, IID_PPV_ARGS(&g.sharedTexture))) &&
        SUCCEEDED(g.device->CreateShaderResourceView(
            g.sharedTexture, nullptr, &g.sharedSrv)) &&
        SUCCEEDED(
            g.device5->OpenSharedFence(dupFence, IID_PPV_ARGS(&g.fence)))) {
      g.feederPid = f.feederProcessId;
      g.texHandleVal = f.textureHandle;
      g.fenceHandleVal = f.fenceHandle;
      ok = true;
      layerLog("Opened shared texture %ux%u from producer PID %u.", f.width,
               f.height, f.feederProcessId);
    }
  }
  // Once OpenShared* succeeds, D3D holds its own reference; close our dups.
  if (dupTex) CloseHandle(dupTex);
  if (dupFence) CloseHandle(dupFence);
  if (!ok) closeSharedResources();
  return ok;
}

// ---------------------------------------------------------------------------
// Swapchain management (recreated when target size/format changes)
// ---------------------------------------------------------------------------
static int64_t pickFormat() {
  uint32_t count = 0;
  g_next_xrEnumerateSwapchainFormats(g.session, 0, &count, nullptr);
  std::vector<int64_t> formats(count);
  g_next_xrEnumerateSwapchainFormats(g.session, count, &count, formats.data());
  // Any RTV-able UNORM format works (we blit through a shader).
  for (int64_t want : {(int64_t)DXGI_FORMAT_R8G8B8A8_UNORM,
                       (int64_t)DXGI_FORMAT_B8G8R8A8_UNORM}) {
    for (int64_t f : formats) {
      if (f == want) return f;
    }
  }
  return formats.empty() ? (int64_t)DXGI_FORMAT_R8G8B8A8_UNORM : formats.front();
}

static void destroySwapchain() {
  for (auto* rtv : g.rtvs) release(rtv);
  g.rtvs.clear();
  g.images.clear();  // OpenXR owns the image textures; do not Release them
  if (g.swapchain) {
    g_next_xrDestroySwapchain(g.swapchain);
    g.swapchain = XR_NULL_HANDLE;
  }
  g.width = g.height = 0;
}

static bool ensureSwapchain(uint32_t w, uint32_t h) {
  if (g.swapchain && g.width == w && g.height == h) return true;
  destroySwapchain();

  if (g.swapchainFormat == 0) g.swapchainFormat = pickFormat();

  XrSwapchainCreateInfo sc{XR_TYPE_SWAPCHAIN_CREATE_INFO};
  sc.usageFlags = XR_SWAPCHAIN_USAGE_COLOR_ATTACHMENT_BIT;
  sc.format = g.swapchainFormat;
  sc.sampleCount = 1;
  sc.width = w;
  sc.height = h;
  sc.faceCount = 1;
  sc.arraySize = 1;
  sc.mipCount = 1;
  if (XR_FAILED(g_next_xrCreateSwapchain(g.session, &sc, &g.swapchain))) {
    layerLog("xrCreateSwapchain failed.");
    g.swapchain = XR_NULL_HANDLE;
    return false;
  }

  uint32_t imageCount = 0;
  g_next_xrEnumerateSwapchainImages(g.swapchain, 0, &imageCount, nullptr);
  std::vector<XrSwapchainImageD3D11KHR> imgs(
      imageCount, {XR_TYPE_SWAPCHAIN_IMAGE_D3D11_KHR});
  g_next_xrEnumerateSwapchainImages(
      g.swapchain, imageCount, &imageCount,
      reinterpret_cast<XrSwapchainImageBaseHeader*>(imgs.data()));

  for (auto& im : imgs) {
    g.images.push_back(im.texture);
    D3D11_RENDER_TARGET_VIEW_DESC rtvDesc{};
    rtvDesc.Format = (DXGI_FORMAT)g.swapchainFormat;
    rtvDesc.ViewDimension = D3D11_RTV_DIMENSION_TEXTURE2D;
    ID3D11RenderTargetView* rtv = nullptr;
    g.device->CreateRenderTargetView(im.texture, &rtvDesc, &rtv);
    g.rtvs.push_back(rtv);
  }
  g.width = w;
  g.height = h;
  return true;
}

// ---------------------------------------------------------------------------
// xrEndFrame
// ---------------------------------------------------------------------------
static XrResult XRAPI_CALL my_xrEndFrame(XrSession session,
                                         const XrFrameEndInfo* frameEndInfo) {
  if (session != g.session || !g.device) {
    return g_next_xrEndFrame(session, frameEndInfo);
  }

  IrdashiesShmHeader frame{};
  const bool haveFrame = readShmFrame(frame) && ensureSharedResources(frame);

  const uint32_t w = haveFrame ? frame.width : kFallbackSize;
  const uint32_t h = haveFrame ? frame.height : kFallbackSize;
  if (!ensureSwapchain(w, h)) {
    return g_next_xrEndFrame(session, frameEndInfo);
  }

  uint32_t idx = 0;
  XrSwapchainImageAcquireInfo acq{XR_TYPE_SWAPCHAIN_IMAGE_ACQUIRE_INFO};
  if (XR_FAILED(g_next_xrAcquireSwapchainImage(g.swapchain, &acq, &idx))) {
    return g_next_xrEndFrame(session, frameEndInfo);
  }
  XrSwapchainImageWaitInfo wait{XR_TYPE_SWAPCHAIN_IMAGE_WAIT_INFO};
  wait.timeout = XR_INFINITE_DURATION;
  g_next_xrWaitSwapchainImage(g.swapchain, &wait);

  if (haveFrame) {
    // Wait on the GPU until the producer signalled this frame is ready, then
    // blit the shared texture into the swapchain image.
    g.context4->Wait(g.fence, frame.fenceValue);

    g.context->OMSetRenderTargets(1, &g.rtvs[idx], nullptr);
    D3D11_VIEWPORT vp{0, 0, (float)w, (float)h, 0, 1};
    g.context->RSSetViewports(1, &vp);
    g.context->IASetInputLayout(nullptr);
    g.context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    g.context->VSSetShader(g.vs, nullptr, 0);
    g.context->PSSetShader(g.ps, nullptr, 0);
    g.context->PSSetShaderResources(0, 1, &g.sharedSrv);
    g.context->PSSetSamplers(0, 1, &g.sampler);
    g.context->Draw(3, 0);

    ID3D11ShaderResourceView* nullSrv = nullptr;
    g.context->PSSetShaderResources(0, 1, &nullSrv);  // clear hazard
  } else {
    // No producer: animated solid color so something is always visible.
    double seconds = (double)frameEndInfo->displayTime / 1e9;
    float pulse = 0.5f + 0.5f * (float)std::sin(seconds * 2.0);
    float clear[4] = {0.0f, 0.6f * pulse + 0.2f, 1.0f, 1.0f};
    if (idx < g.rtvs.size() && g.rtvs[idx]) {
      g.context->ClearRenderTargetView(g.rtvs[idx], clear);
    }
  }

  XrSwapchainImageReleaseInfo rel{XR_TYPE_SWAPCHAIN_IMAGE_RELEASE_INFO};
  g_next_xrReleaseSwapchainImage(g.swapchain, &rel);

  XrCompositionLayerQuad quad{XR_TYPE_COMPOSITION_LAYER_QUAD};
  // Real producer frames are premultiplied-alpha (Chromium OSR) - blend so
  // transparent page areas are see-through. The fallback pulse is opaque.
  quad.layerFlags =
      haveFrame ? XR_COMPOSITION_LAYER_BLEND_TEXTURE_SOURCE_ALPHA_BIT : 0;
  quad.space = g.localSpace;
  quad.eyeVisibility = XR_EYE_VISIBILITY_BOTH;
  quad.subImage.swapchain = g.swapchain;
  quad.subImage.imageRect = {{0, 0}, {(int32_t)w, (int32_t)h}};
  quad.subImage.imageArrayIndex = 0;
  if (haveFrame) {
    quad.pose.orientation = {frame.poseOrientation[0], frame.poseOrientation[1],
                             frame.poseOrientation[2], frame.poseOrientation[3]};
    quad.pose.position = {frame.posePosition[0], frame.posePosition[1],
                          frame.posePosition[2]};
    quad.size = {frame.quadSizeMeters[0], frame.quadSizeMeters[1]};
  } else {
    quad.pose.orientation = {0, 0, 0, 1};
    quad.pose.position = {0, 0, -1.5f};
    quad.size = {0.5f, 0.5f};
  }

  std::vector<const XrCompositionLayerBaseHeader*> layers(
      frameEndInfo->layers, frameEndInfo->layers + frameEndInfo->layerCount);
  layers.push_back(reinterpret_cast<const XrCompositionLayerBaseHeader*>(&quad));

  XrFrameEndInfo patched = *frameEndInfo;
  patched.layerCount = (uint32_t)layers.size();
  patched.layers = layers.data();
  return g_next_xrEndFrame(session, &patched);
}

// ---------------------------------------------------------------------------
// xrCreateSession / xrDestroySession
// ---------------------------------------------------------------------------
static XrResult XRAPI_CALL my_xrCreateSession(
    XrInstance instance, const XrSessionCreateInfo* createInfo,
    XrSession* session) {
  XrResult res = g_next_xrCreateSession(instance, createInfo, session);
  if (XR_FAILED(res)) return res;

  const XrBaseInStructure* base =
      reinterpret_cast<const XrBaseInStructure*>(createInfo->next);
  const XrGraphicsBindingD3D11KHR* d3d = nullptr;
  while (base) {
    if (base->type == XR_TYPE_GRAPHICS_BINDING_D3D11_KHR) {
      d3d = reinterpret_cast<const XrGraphicsBindingD3D11KHR*>(base);
      break;
    }
    base = base->next;
  }
  if (!d3d || !d3d->device) {
    layerLog("Session created but no D3D11 binding - overlay disabled.");
    return res;
  }

  g = SessionState{};
  g.session = *session;
  g.device = d3d->device;
  g.device->QueryInterface(IID_PPV_ARGS(&g.device1));
  g.device->QueryInterface(IID_PPV_ARGS(&g.device5));
  g.device->GetImmediateContext(&g.context);
  g.context->QueryInterface(IID_PPV_ARGS(&g.context4));
  if (!g.device1 || !g.device5 || !g.context4) {
    layerLog("Required D3D11.1/11.4 interfaces unavailable - overlay disabled.");
    g = SessionState{};
    return res;
  }

  XrReferenceSpaceCreateInfo spaceInfo{XR_TYPE_REFERENCE_SPACE_CREATE_INFO};
  spaceInfo.referenceSpaceType = XR_REFERENCE_SPACE_TYPE_LOCAL;
  spaceInfo.poseInReferenceSpace.orientation = {0, 0, 0, 1};
  if (XR_FAILED(g_next_xrCreateReferenceSpace(*session, &spaceInfo,
                                              &g.localSpace))) {
    layerLog("Failed to create LOCAL reference space.");
    g = SessionState{};
    return res;
  }

  if (!createBlitPipeline()) {
    layerLog("Failed to create blit pipeline - overlay disabled.");
    return res;
  }

  layerLog("Session ready - overlay active.");
  return res;
}

static XrResult XRAPI_CALL my_xrDestroySession(XrSession session) {
  if (session == g.session) {
    closeSharedResources();
    destroySwapchain();
    release(g.sampler);
    release(g.vs);
    release(g.ps);
    if (g.localSpace) g_next_xrDestroySpace(g.localSpace);
    release(g.context4);
    release(g.context);
    release(g.device5);
    release(g.device1);
    g = SessionState{};
  }
  return g_next_xrDestroySession(session);
}

// ---------------------------------------------------------------------------
// Proc address interception
// ---------------------------------------------------------------------------
static XrResult XRAPI_CALL my_xrGetInstanceProcAddr(
    XrInstance instance, const char* name, PFN_xrVoidFunction* function) {
  if (!g_nextGetInstanceProcAddr) return XR_ERROR_HANDLE_INVALID;

  std::string_view n{name};
  if (n == "xrCreateSession") {
    *function = reinterpret_cast<PFN_xrVoidFunction>(my_xrCreateSession);
    return XR_SUCCESS;
  }
  if (n == "xrDestroySession") {
    *function = reinterpret_cast<PFN_xrVoidFunction>(my_xrDestroySession);
    return XR_SUCCESS;
  }
  if (n == "xrEndFrame") {
    *function = reinterpret_cast<PFN_xrVoidFunction>(my_xrEndFrame);
    return XR_SUCCESS;
  }
  return g_nextGetInstanceProcAddr(instance, name, function);
}

static XrResult XRAPI_CALL my_xrCreateApiLayerInstance(
    const XrInstanceCreateInfo* info, const XrApiLayerCreateInfo* layerInfo,
    XrInstance* instance) {
  if (!layerInfo || !layerInfo->nextInfo) {
    return XR_ERROR_INITIALIZATION_FAILED;
  }

  g_nextGetInstanceProcAddr = layerInfo->nextInfo->nextGetInstanceProcAddr;

  XrApiLayerCreateInfo nextLayerInfo = *layerInfo;
  nextLayerInfo.nextInfo = layerInfo->nextInfo->next;

  XrResult res = layerInfo->nextInfo->nextCreateApiLayerInstance(
      info, &nextLayerInfo, instance);
  if (XR_FAILED(res)) return res;

#define LOAD(fn)                                            \
  g_nextGetInstanceProcAddr(*instance, #fn,                 \
                            reinterpret_cast<PFN_xrVoidFunction*>(&g_next_##fn))
  LOAD(xrCreateSession);
  LOAD(xrDestroySession);
  LOAD(xrEndFrame);
  LOAD(xrEnumerateSwapchainFormats);
  LOAD(xrCreateSwapchain);
  LOAD(xrDestroySwapchain);
  LOAD(xrEnumerateSwapchainImages);
  LOAD(xrAcquireSwapchainImage);
  LOAD(xrWaitSwapchainImage);
  LOAD(xrReleaseSwapchainImage);
  LOAD(xrCreateReferenceSpace);
  LOAD(xrDestroySpace);
#undef LOAD

  layerLog("API layer instance created.");
  return res;
}

// ---------------------------------------------------------------------------
// Loader negotiation entry point (name must match the JSON manifest)
// ---------------------------------------------------------------------------
extern "C" __declspec(dllexport) XrResult XRAPI_CALL
irDashies_xrNegotiateLoaderApiLayerInterface(
    const XrNegotiateLoaderInfo* loaderInfo, const char* layerName,
    XrNegotiateApiLayerRequest* apiLayerRequest) {
  (void)layerName;
  if (!loaderInfo || !apiLayerRequest) {
    return XR_ERROR_INITIALIZATION_FAILED;
  }
  if (loaderInfo->structType != XR_LOADER_INTERFACE_STRUCT_LOADER_INFO ||
      apiLayerRequest->structType !=
          XR_LOADER_INTERFACE_STRUCT_API_LAYER_REQUEST) {
    return XR_ERROR_INITIALIZATION_FAILED;
  }

  apiLayerRequest->layerInterfaceVersion = XR_CURRENT_LOADER_API_LAYER_VERSION;
  apiLayerRequest->layerApiVersion = XR_CURRENT_API_VERSION;
  apiLayerRequest->getInstanceProcAddr = my_xrGetInstanceProcAddr;
  apiLayerRequest->createApiLayerInstance = my_xrCreateApiLayerInstance;

  layerLog("Negotiated with OpenXR loader.");
  return XR_SUCCESS;
}
