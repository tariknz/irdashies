#ifndef IRDASHIES_IRSDK_CAPTURE_H
#define IRDASHIES_IRSDK_CAPTURE_H

#include <atomic>
#include <climits>
#include <cstddef>
#include <cstring>
#include <vector>

#include "irsdk_defines.h"

// Own the allocation and the metadata that described the copied bytes together.
// Storage is reused between frames; valid is cleared before any partial copy.
struct irsdk_capture {
  std::vector<char> data;
  std::vector<irsdk_varHeader> variables;
  std::vector<irsdk_varHeader> verifyVariables;
  irsdk_header header{};
  bool valid = false;
};

namespace irdashies { namespace irsdk {

// Match the existing native tape safety limits.
constexpr std::size_t maxMappingBytes = 512U * 1024U * 1024U;
constexpr std::size_t maxFrameBytes = 64U * 1024U * 1024U;
constexpr int maxVariables = 4096;

inline bool byteRange(std::size_t offset, std::size_t length,
                      std::size_t available) {
  return offset <= available && length <= available - offset;
}

inline bool variableRange(const irsdk_varHeader& var, std::size_t frameBytes,
                          std::size_t& bytes) {
  bytes = 0;
  if (var.type < 0 || var.type >= irsdk_ETCount || var.count <= 0 ||
      var.offset < 0 || static_cast<std::size_t>(var.offset) > frameBytes) {
    return false;
  }
  const auto width = static_cast<std::size_t>(irsdk_VarTypeBytes[var.type]);
  // Divide before multiplying: no signed or size_t multiplication overflow.
  if (static_cast<std::size_t>(var.count) >
      (frameBytes - static_cast<std::size_t>(var.offset)) / width) {
    return false;
  }
  // A corrupt shared-memory bool must never be evaluated as a C++ bool.
  unsigned char countAsTime = 0;
  std::memcpy(&countAsTime, &var.countAsTime, sizeof(countAsTime));
  if (countAsTime > 1) return false;
  bytes = static_cast<std::size_t>(var.count) * width;
  return true;
}

inline const irsdk_varHeader* capturedVariable(const irsdk_capture& capture,
                                              int index) {
  if (!capture.valid || index < 0 ||
      static_cast<std::size_t>(index) >= capture.variables.size()) return nullptr;
  const auto& var = capture.variables[static_cast<std::size_t>(index)];
  std::size_t bytes = 0;
  return variableRange(var, capture.data.size(), bytes) ? &var : nullptr;
}

inline bool sameLayout(const irsdk_header& a, const irsdk_header& b) {
  if (a.ver != b.ver || a.tickRate != b.tickRate || a.bufLen != b.bufLen ||
      a.numBuf != b.numBuf || a.numVars != b.numVars ||
      a.varHeaderOffset != b.varHeaderOffset ||
      a.sessionInfoOffset != b.sessionInfoOffset ||
      a.numBuf <= 0 || a.numBuf > IRSDK_MAX_BUFS) return false;
  for (int i = 0; i < a.numBuf; ++i) {
    if (a.varBuf[i].bufOffset != b.varBuf[i].bufOffset) return false;
  }
  return true;
}

inline bool validLayout(const irsdk_header& header, std::size_t mappingBytes) {
  if (header.ver <= 0 || header.tickRate <= 0 || header.tickRate > 10000 ||
      header.numBuf <= 0 || header.numBuf > IRSDK_MAX_BUFS ||
      header.bufLen <= 0 ||
      static_cast<std::size_t>(header.bufLen) > maxFrameBytes ||
      header.numVars <= 0 || header.numVars > maxVariables ||
      header.varHeaderOffset < static_cast<int>(sizeof(irsdk_header))) {
    return false;
  }
  const auto metadataBytes = static_cast<std::size_t>(header.numVars) *
      sizeof(irsdk_varHeader);
  if (!byteRange(static_cast<std::size_t>(header.varHeaderOffset),
                 metadataBytes, mappingBytes)) return false;
  const auto overlaps = [](std::size_t a, std::size_t aBytes,
                           std::size_t b, std::size_t bBytes) {
    return a < b + bBytes && b < a + aBytes;
  };
  for (int i = 0; i < header.numBuf; ++i) {
    if (header.varBuf[i].bufOffset < static_cast<int>(sizeof(irsdk_header)) ||
        !byteRange(static_cast<std::size_t>(header.varBuf[i].bufOffset),
                   static_cast<std::size_t>(header.bufLen), mappingBytes)) {
      return false;
    }
    const auto offset = static_cast<std::size_t>(header.varBuf[i].bufOffset);
    const auto length = static_cast<std::size_t>(header.bufLen);
    if (overlaps(offset, length,
                 static_cast<std::size_t>(header.varHeaderOffset), metadataBytes)) return false;
    for (int j = 0; j < i; ++j) {
      if (overlaps(offset, length,
                   static_cast<std::size_t>(header.varBuf[j].bufOffset), length)) return false;
    }
  }
  return true;
}

// Read receives (offset, destination, length). The mapping owner guarantees its
// lifetime and bounds; all copy sizes/offsets come from a validated local header,
// never from a second load of the producer's mutable header. Keeping this core
// platform-independent also lets sanitizers exercise the actual capture code.
template <typename Read>
bool captureFrame(Read read, std::size_t mappingBytes, int& lastTick,
                  irsdk_capture* capture) {
  if (mappingBytes > maxMappingBytes) mappingBytes = maxMappingBytes;
  for (int attempt = 0; attempt < 2; ++attempt) {
    irsdk_header before{};
    std::atomic_thread_fence(std::memory_order_seq_cst);
    if (!byteRange(0, sizeof(before), mappingBytes) ||
        !read(0, &before, sizeof(before)) ||
        !(before.status & irsdk_stConnected) ||
        !validLayout(before, mappingBytes)) {
      if (capture) capture->valid = false;
      lastTick = INT_MAX;
      return false;
    }
    int latest = 0;
    for (int i = 1; i < before.numBuf; ++i) {
      if (before.varBuf[i].tickCount > before.varBuf[latest].tickCount) latest = i;
    }
    const int tick = before.varBuf[latest].tickCount;
    // A reconnect can replace the layout while paused at the same source tick.
    if (capture && capture->header.ver != 0 &&
        !sameLayout(capture->header, before)) lastTick = INT_MAX;
    // Retain the SDK's backward-tick resynchronization and paused-tick behavior.
    if (lastTick != INT_MAX && tick <= lastTick) {
      if (tick < lastTick) {
        lastTick = tick;
        if (capture) capture->valid = false;
      }
      return false;
    }
    if (!capture) {
      lastTick = tick;
      return true;
    }
    capture->valid = false;
    // Resize BEFORE copying on every attempt, including retries after a changed
    // header. vector::size is the readable frame length, not spare capacity.
    capture->data.resize(static_cast<std::size_t>(before.bufLen));
    capture->variables.resize(static_cast<std::size_t>(before.numVars));
    capture->verifyVariables.resize(capture->variables.size());
    const auto metadataBytes = capture->variables.size() * sizeof(irsdk_varHeader);
    const auto metadataOffset = static_cast<std::size_t>(before.varHeaderOffset);
    if (!read(metadataOffset, capture->variables.data(), metadataBytes) ||
        !read(static_cast<std::size_t>(before.varBuf[latest].bufOffset),
              capture->data.data(), capture->data.size())) return false;
    std::atomic_thread_fence(std::memory_order_seq_cst);
    if (!read(metadataOffset, capture->verifyVariables.data(), metadataBytes)) return false;
    irsdk_header after{};
    std::atomic_thread_fence(std::memory_order_seq_cst);
    if (!read(0, &after, sizeof(after))) return false;
    if ((after.status & irsdk_stConnected) && sameLayout(before, after) &&
        after.varBuf[latest].tickCount == tick &&
        std::memcmp(capture->variables.data(), capture->verifyVariables.data(),
                    metadataBytes) == 0) {
      capture->header = before;
      capture->valid = true;
      lastTick = tick;
      return true;
    }
  }
  // No tick is consumed on a torn capture; a later call can retry it.
  return false;
}

}} // namespace irdashies::irsdk
#endif
