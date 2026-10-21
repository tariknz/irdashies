// The live source: LMU's shared-memory mapping.
//
// Lifted out of lmu_node.cc so the replay build can link a tape-backed
// implementation of the same seam against the identical conversion code.
//
// The handle and view are per-instance. See lmu_source.h for why that matters:
// a probe and a bridge are routinely attached at the same time.

#include "lmu_source.h"

#include <cstring>

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

namespace irdashies::lmu {
namespace {

const wchar_t* kSharedMemoryName = L"LMU_Data";

}  // namespace

struct LmuSource::Impl {
  HANDLE map = NULL;
  std::uint8_t* view = nullptr;
  const LMUObjectOut* mapped = nullptr;

  LMUSnapshotState liveState() const {
    return {
        mapped->generic.events.SME_UPDATE_SCORING,
        mapped->generic.events.SME_UPDATE_TELEMETRY,
    };
  }

  void release() {
    mapped = nullptr;
    if (view != nullptr) {
      UnmapViewOfFile(view);
      view = nullptr;
    }
    if (map != NULL) {
      CloseHandle(map);
      map = NULL;
    }
  }
};

LmuSource::LmuSource() : impl_(std::make_unique<Impl>()) {}

LmuSource::~LmuSource() { impl_->release(); }

bool LmuSource::open() {
  if (impl_->mapped != nullptr) return true;
  impl_->release();

  impl_->map = OpenFileMappingW(FILE_MAP_READ, FALSE, kSharedMemoryName);
  if (impl_->map == NULL) return false;

  impl_->view = static_cast<std::uint8_t*>(
      MapViewOfFile(impl_->map, FILE_MAP_READ, 0, 0, 0));
  if (impl_->view == NULL) {
    CloseHandle(impl_->map);
    impl_->map = NULL;
    return false;
  }

  MEMORY_BASIC_INFORMATION region{};
  if (VirtualQuery(impl_->view, &region, sizeof(region)) == 0 ||
      region.RegionSize < sizeof(LMUObjectOut)) {
    impl_->release();
    return false;
  }

  impl_->mapped = reinterpret_cast<const LMUObjectOut*>(impl_->view);
  return true;
}

void LmuSource::close() { impl_->release(); }

bool LmuSource::capture(LMUObjectOut& out) {
  if (impl_->mapped == nullptr) return false;

  for (int attempt = 0; attempt < 4; ++attempt) {
    // Cheap gate before the expensive part. The copy below is ~317 KB out of
    // a mapping the sim is actively writing, and an attempt that was going to
    // fail used to pay for it in full before anything was checked. Two
    // counter reads cost sixteen bytes and catch a writer mid-burst first.
    const LMUSnapshotState before = impl_->liveState();
    MemoryBarrier();
    if (!IsQuietLmuWriter(before, impl_->liveState())) continue;

    MemoryBarrier();
    LMUObjectOut candidate;
    std::memcpy(&candidate, impl_->mapped, sizeof(candidate));
    MemoryBarrier();
    const LMUSnapshotState snapshot = {
        candidate.generic.events.SME_UPDATE_SCORING,
        candidate.generic.events.SME_UPDATE_TELEMETRY,
    };
    const LMUSnapshotState after = impl_->liveState();

    if (!IsCoherentLmuSnapshot(before, snapshot, after)) continue;

    out = candidate;
    return true;
  }

  return false;
}

bool LmuSource::restBody(const std::string& path, std::string& out) const {
  // Shared memory carries no REST responses; the live build reaches the API
  // over HTTP from the JS side instead. Only a tape has anything here.
  (void)path;
  (void)out;
  return false;
}

bool LmuSource::isLive(const LMUObjectOut& snapshot) const {
  const auto window = reinterpret_cast<HWND>(
      static_cast<uintptr_t>(snapshot.generic.appInfo.mAppWindow));
  return window != NULL && ::IsWindow(window);
}

}  // namespace irdashies::lmu
