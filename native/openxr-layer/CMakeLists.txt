cmake_minimum_required(VERSION 3.22)
project(irdashies_openxr_layer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# OpenXR SDK - we only need the headers (XrNegotiate*, loader_interfaces.h, etc).
# Build only our target (cmake --build --target irDashiesOpenXRLayer) so the
# loader/tests in the SDK are never compiled.
set(BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(BUILD_CONFORMANCE_TESTS OFF CACHE BOOL "" FORCE)
set(BUILD_API_LAYERS OFF CACHE BOOL "" FORCE)
set(DYNAMIC_LOADER OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  OpenXR
  GIT_REPOSITORY https://github.com/KhronosGroup/OpenXR-SDK.git
  GIT_TAG release-1.1.43
)
FetchContent_MakeAvailable(OpenXR)

add_library(irDashiesOpenXRLayer SHARED src/layer.cpp)

target_link_libraries(irDashiesOpenXRLayer PRIVATE OpenXR::headers d3d11)

# Note: XR_USE_GRAPHICS_API_D3D11 / WIN32_LEAN_AND_MEAN / NOMINMAX are defined
# at the top of layer.cpp (must precede the openxr_platform.h include).

set_target_properties(irDashiesOpenXRLayer PROPERTIES
  OUTPUT_NAME "irDashies-OpenXR-Layer"
)

# Generate the API-layer manifest with the absolute path to the built DLL.
# file(GENERATE) evaluates the $<TARGET_FILE:...> generator expression.
# Multi-config generators (VS) need a per-config output path because the DLL
# path differs per config (Debug/ vs Release/).
file(GENERATE
  OUTPUT "${CMAKE_BINARY_DIR}/$<CONFIG>/irDashies-OpenXR.json"
  INPUT "${CMAKE_CURRENT_SOURCE_DIR}/irDashies-OpenXR.json.in"
)
