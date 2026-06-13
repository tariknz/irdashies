// irDashies OpenXR API layer - PoC
// Goal: prove injection + quad render. Clears a swapchain to an animated
// solid color and staples one XrCompositionLayerQuad ~1.5m in front of user.
// No texture sharing, no SHM, no Electron. Just the injection mechanism.

#define XR_USE_GRAPHICS_API_D3D11
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX

#include <d3d11.h>
#include <openxr/openxr.h>
#include <openxr/openxr_platform.h>
// Loader<->API-layer negotiation types. Note: pre-1.0.33 SDKs called this
// header <openxr/loader_interfaces.h>; it was renamed in 1.0.33.
#include <openxr/openxr_loader_negotiation.h>

#include <cstdio>
#include <cmath>
#include <string_view>
#include <vector>

// ---------------------------------------------------------------------------
// Logging (no debugger available in injected game process; log to file)
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
// Single-session PoC state
// ---------------------------------------------------------------------------
static constexpr uint32_t kQuadSize = 512;

struct SessionState {
  XrSession session = XR_NULL_HANDLE;
  ID3D11Device* device = nullptr;
  ID3D11DeviceContext* context = nullptr;
  XrSpace localSpace = XR_NULL_HANDLE;
  XrSwapchain swapchain = XR_NULL_HANDLE;
  std::vector<ID3D11RenderTargetView*> rtvs;
  uint32_t width = 0;
  uint32_t height = 0;
};
static SessionState g_session;

static int64_t pickFormat(const std::vector<int64_t>& formats) {
  // Prefer plain UNORM formats we can clear + RTV without surprises.
  for (int64_t want : {(int64_t)DXGI_FORMAT_R8G8B8A8_UNORM,
                       (int64_t)DXGI_FORMAT_B8G8R8A8_UNORM}) {
    for (int64_t f : formats) {
      if (f == want) return f;
    }
  }
  return formats.empty() ? (int64_t)DXGI_FORMAT_R8G8B8A8_UNORM : formats.front();
}

// ---------------------------------------------------------------------------
// xrEndFrame: render quad texture + append composition layer
// ---------------------------------------------------------------------------
static XrResult XRAPI_CALL my_xrEndFrame(XrSession session,
                                         const XrFrameEndInfo* frameEndInfo) {
  if (session != g_session.session || g_session.swapchain == XR_NULL_HANDLE) {
    return g_next_xrEndFrame(session, frameEndInfo);
  }

  uint32_t imageIndex = 0;
  XrSwapchainImageAcquireInfo acquire{XR_TYPE_SWAPCHAIN_IMAGE_ACQUIRE_INFO};
  if (XR_FAILED(g_next_xrAcquireSwapchainImage(g_session.swapchain, &acquire,
                                               &imageIndex))) {
    return g_next_xrEndFrame(session, frameEndInfo);
  }
  XrSwapchainImageWaitInfo wait{XR_TYPE_SWAPCHAIN_IMAGE_WAIT_INFO};
  wait.timeout = XR_INFINITE_DURATION;
  g_next_xrWaitSwapchainImage(g_session.swapchain, &wait);

  // Animate color over time so it's obvious the layer is live (not a freeze).
  double seconds = (double)frameEndInfo->displayTime / 1e9;
  float pulse = 0.5f + 0.5f * (float)std::sin(seconds * 2.0);
  float clear[4] = {0.0f, 0.6f * pulse + 0.2f, 1.0f, 1.0f};  // opaque blue/cyan
  if (imageIndex < g_session.rtvs.size() && g_session.rtvs[imageIndex]) {
    g_session.context->ClearRenderTargetView(g_session.rtvs[imageIndex], clear);
  }

  XrSwapchainImageReleaseInfo release{XR_TYPE_SWAPCHAIN_IMAGE_RELEASE_INFO};
  g_next_xrReleaseSwapchainImage(g_session.swapchain, &release);

  XrCompositionLayerQuad quad{XR_TYPE_COMPOSITION_LAYER_QUAD};
  quad.layerFlags = 0;  // opaque
  quad.space = g_session.localSpace;
  quad.eyeVisibility = XR_EYE_VISIBILITY_BOTH;
  quad.subImage.swapchain = g_session.swapchain;
  quad.subImage.imageRect = {{0, 0},
                             {(int32_t)g_session.width, (int32_t)g_session.height}};
  quad.subImage.imageArrayIndex = 0;
  quad.pose.orientation = {0.0f, 0.0f, 0.0f, 1.0f};
  quad.pose.position = {0.0f, 0.0f, -1.5f};  // 1.5m in front of LOCAL origin
  quad.size = {0.5f, 0.5f};                  // 0.5m x 0.5m

  // Append our quad to whatever the game already submitted (drawn last = on top).
  std::vector<const XrCompositionLayerBaseHeader*> layers(
      frameEndInfo->layers, frameEndInfo->layers + frameEndInfo->layerCount);
  layers.push_back(
      reinterpret_cast<const XrCompositionLayerBaseHeader*>(&quad));

  XrFrameEndInfo patched = *frameEndInfo;
  patched.layerCount = (uint32_t)layers.size();
  patched.layers = layers.data();
  return g_next_xrEndFrame(session, &patched);
}

// ---------------------------------------------------------------------------
// xrCreateSession: grab D3D11 device, create space + swapchain + RTVs
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

  g_session = SessionState{};
  g_session.session = *session;
  g_session.device = d3d->device;
  d3d->device->GetImmediateContext(&g_session.context);

  XrReferenceSpaceCreateInfo spaceInfo{XR_TYPE_REFERENCE_SPACE_CREATE_INFO};
  spaceInfo.referenceSpaceType = XR_REFERENCE_SPACE_TYPE_LOCAL;
  spaceInfo.poseInReferenceSpace.orientation = {0.0f, 0.0f, 0.0f, 1.0f};
  spaceInfo.poseInReferenceSpace.position = {0.0f, 0.0f, 0.0f};
  if (XR_FAILED(g_next_xrCreateReferenceSpace(*session, &spaceInfo,
                                              &g_session.localSpace))) {
    layerLog("Failed to create LOCAL reference space.");
    return res;
  }

  uint32_t formatCount = 0;
  g_next_xrEnumerateSwapchainFormats(*session, 0, &formatCount, nullptr);
  std::vector<int64_t> formats(formatCount);
  g_next_xrEnumerateSwapchainFormats(*session, formatCount, &formatCount,
                                     formats.data());
  int64_t format = pickFormat(formats);

  XrSwapchainCreateInfo sc{XR_TYPE_SWAPCHAIN_CREATE_INFO};
  sc.usageFlags = XR_SWAPCHAIN_USAGE_COLOR_ATTACHMENT_BIT;
  sc.format = format;
  sc.sampleCount = 1;
  sc.width = kQuadSize;
  sc.height = kQuadSize;
  sc.faceCount = 1;
  sc.arraySize = 1;
  sc.mipCount = 1;
  if (XR_FAILED(
          g_next_xrCreateSwapchain(*session, &sc, &g_session.swapchain))) {
    layerLog("Failed to create swapchain.");
    g_session.swapchain = XR_NULL_HANDLE;
    return res;
  }
  g_session.width = kQuadSize;
  g_session.height = kQuadSize;

  uint32_t imageCount = 0;
  g_next_xrEnumerateSwapchainImages(g_session.swapchain, 0, &imageCount,
                                    nullptr);
  std::vector<XrSwapchainImageD3D11KHR> images(
      imageCount, {XR_TYPE_SWAPCHAIN_IMAGE_D3D11_KHR});
  g_next_xrEnumerateSwapchainImages(
      g_session.swapchain, imageCount, &imageCount,
      reinterpret_cast<XrSwapchainImageBaseHeader*>(images.data()));

  for (auto& image : images) {
    D3D11_RENDER_TARGET_VIEW_DESC rtvDesc{};
    rtvDesc.Format = (DXGI_FORMAT)format;
    rtvDesc.ViewDimension = D3D11_RTV_DIMENSION_TEXTURE2D;
    ID3D11RenderTargetView* rtv = nullptr;
    if (SUCCEEDED(g_session.device->CreateRenderTargetView(image.texture,
                                                           &rtvDesc, &rtv))) {
      g_session.rtvs.push_back(rtv);
    } else {
      g_session.rtvs.push_back(nullptr);
      layerLog("Failed to create RTV for a swapchain image.");
    }
  }

  layerLog("Session ready: format=%lld images=%u - overlay active.",
           (long long)format, imageCount);
  return res;
}

static XrResult XRAPI_CALL my_xrDestroySession(XrSession session) {
  if (session == g_session.session) {
    for (auto* rtv : g_session.rtvs) {
      if (rtv) rtv->Release();
    }
    g_session.rtvs.clear();
    if (g_session.swapchain) g_next_xrDestroySwapchain(g_session.swapchain);
    if (g_session.localSpace) g_next_xrDestroySpace(g_session.localSpace);
    if (g_session.context) g_session.context->Release();
    g_session = SessionState{};
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

  // Advance the chain so the next layer/runtime sees its own nextInfo.
  XrApiLayerCreateInfo nextLayerInfo = *layerInfo;
  nextLayerInfo.nextInfo = layerInfo->nextInfo->next;

  XrResult res = layerInfo->nextInfo->nextCreateApiLayerInstance(
      info, &nextLayerInfo, instance);
  if (XR_FAILED(res)) return res;

#define LOAD(fn)                                                            \
  g_nextGetInstanceProcAddr(*instance, #fn,                                 \
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
