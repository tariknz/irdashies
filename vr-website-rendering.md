# How Website Render in VR/OpenXR (caveman)

How web page show up floating in VR headset. Caveman style. Substance full, fluff dead.

## Big Picture

Two process. Texture cross gap = shared memory (SHM) + shared GPU texture.

```
[OpenKneeboard app process]                    [Game process]
  BrowserTab                                      injected OpenXR API layer (DLL)
   └ ChromiumPageSource (CEF offscreen)            └ hooks xrEndFrame
        └ web page → D3D11 texture                      └ reads SHM
             └ InterprocessRenderer composites             └ copies shared texture
                  all tabs into 1 canvas                        into OpenXR quad swapchain
                   └ SHM::Writer  ──shared NT handle + fence──►   └ adds XrCompositionLayerQuad
                                                                       └ calls real xrEndFrame
```

Website NOT rendered in VR direct. Rendered to texture in app. Shared cross-process to GPU. Game-side OpenXR layer staple it onto frame as quad layer in 3D space.

## Stage 1 — Website → Texture (app process)

- `BrowserTab` (`src/app/app-common/Tab/BrowserTab.cpp`) wrap `ChromiumPageSource` = CEF (Chromium Embedded Framework) browser. Windowless/offscreen render mode.
- CEF render page GPU-accelerated. Deliver frame via `OnAcceleratedPaint` (`ChromiumPageSource_RenderHandler.cpp:94`). Give shared D3D11 texture handle, NOT pixel buffer.
- `OnPaint` (`:36`) = CPU fallback. Only VM/testing. Warns if hit (`:48`).
- RenderHandler open CEF shared handle every frame (CEF ban caching it, `:117`). Copy into triple-buffered texture `mFrames[3]` (`:24`). Signal D3D11 fence (`:176`).
- `RenderPage` (`:191`) draw texture onto kneeboard page via `SpriteBatch`. Fence-synced (`ctx->Wait`, `:210`).

## Stage 2 — Composite + Write SHM (app process)

- `InterprocessRenderer::SubmitFrame` (`InterprocessRenderer.cpp:37`) composite all tabs/layers into one canvas texture.
- Copy canvas → IPC shared texture (`CopySubresourceRegion`, `:75`). Signal fence (`:80`).
- `SHM::Writer::SubmitFrame` (`SHM.hpp:107`) write metadata: `Config` (texture size, VR settings, tint) + per-layer `LayerConfig` (pose, physical size, opacity, `mLocationOnTexture`) + shared texture HANDLE + fence HANDLE.
- SHM = ring buffer, `SwapChainLength` frames (`SHM.hpp:36`).
- Texture format fixed: `DXGI_FORMAT_B8G8R8A8_UNORM`, premultiplied alpha (`SHM.hpp:50-52`).

## Stage 3 — Inject as OpenXR API Layer (game process)

- DLL = OpenXR implicit API layer. `OpenKneeboard_xrNegotiateLoaderApiLayerInterface` (`OpenXRKneeboard.cpp:893`) handshake with OpenXR loader.
- Hook `xrGetInstanceProcAddr` (`:761`). Intercept chosen funcs. Rest pass to `Next()` (real runtime / next layer).
- `xrCreateSession` (`:479`) sniff graphics binding in next-chain. Pick subclass:
  - `XrGraphicsBindingD3D11KHR` → `OpenXRD3D11Kneeboard`
  - D3D12 → `OpenXRD3D12Kneeboard`
  - Vulkan (need `XR_KHR_vulkan_enable2`) → `OpenXRVulkanKneeboard`
- Create matching `SHM::*::Reader` on game GPU device (`OpenXRD3D11Kneeboard.cpp:50`).

## Stage 4 — Inject Layers Each Frame: `xrEndFrame` (`:202`)

Workhorse. Per frame:

1. Read SHM frame (`GetSHM().MaybeGet`, `:219`). No frame/layers → pass through untouched (`:226`).
2. **Spriting**: `Spriting::GetBufferSize` (`:234`) pack all kneeboard layers into one texture atlas (side-by-side sprites). Create/resize quad swapchain to fit (`:244`).
3. `GetHMDPose` (`:260`, `:413`) = `xrLocateSpace` view-space vs local-space. Head position/orientation.
4. Per layer build `XrCompositionLayerQuad` (`:346`): pose, physical size, opacity, sub-image rect into swapchain atlas, `LOCAL` reference space. Alpha-blended (`:349`).
5. Acquire → Wait → `RenderLayers` → Release swapchain image (`:370-395`).
   - `RenderLayers` (`OpenXRD3D11Kneeboard.cpp:190`): `mSHM->Map(frame)` open app shared texture into game device. `Renderer` sprite-copy sprites into swapchain image. Fence-synced.
6. Append OK quads to game existing layer array (`:362`). Call real `xrEndFrame` with extended list (`:404`). Respect `mMaxLayerCount` (`:262`).

## Cross-Process Magic

- **Texture**: DXGI shared NT handle (`D3D11_RESOURCE_MISC_SHARED_NTHANDLE`). Game open via `OpenSharedResource1`. Zero-copy GPU-to-GPU on same adapter.
- **Sync**: D3D11 fence handles shared too. Producer signal, consumer wait. No tearing.
- **Metadata**: plain shared memory ring (poses, sizes, layer config).

## API Variant Notes

- D3D11 = native path.
- D3D12 / Vulkan = own subclass + interop (`OpenXRD3D12Kneeboard`, `OpenXRVulkanKneeboard`). Copy BGRA shared texture into their swapchain. Same SHM source.
- OpenVR (SteamVR non-OpenXR) = separate `SteamVRKneeboard.cpp` path. Same SHM source.
  </content>
  </invoke>
