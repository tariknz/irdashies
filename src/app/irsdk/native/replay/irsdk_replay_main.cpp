#ifndef NOMINMAX
#define NOMINMAX
#endif
#define UNICODE
#define _UNICODE

#include <windows.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <iostream>
#include <limits>
#include <optional>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include "../lib/irsdk_shared_objects.h"
#include "./irsdk_tape.h"

namespace replay = irdashies::irsdk_replay;

namespace {

std::atomic_bool stopRequested = false;

struct SharedObjectNames {
  const wchar_t* mapping;
  const wchar_t* event;
  const char* owner;
};

constexpr SharedObjectNames kIRacingObjectNames = {
    IRDASHIES_IRSDK_PRODUCTION_MAPPING_NAME,
    IRDASHIES_IRSDK_PRODUCTION_EVENT_NAME,
    "iRacing"};

constexpr SharedObjectNames kIsolatedReplayObjectNames = {
    IRDASHIES_IRSDK_REPLAY_MAPPING_NAME,
    IRDASHIES_IRSDK_REPLAY_EVENT_NAME,
    "irDashies replay"};

BOOL WINAPI handleConsoleSignal(DWORD signal) {
  if (signal == CTRL_C_EVENT || signal == CTRL_BREAK_EVENT ||
      signal == CTRL_CLOSE_EVENT) {
    stopRequested.store(true);
    return TRUE;
  }
  return FALSE;
}

std::string windowsError(const char* operation) {
  std::ostringstream message;
  message << operation << " failed with Windows error " << GetLastError();
  return message.str();
}

std::optional<std::wstring> optionValue(
    const std::vector<std::wstring>& arguments,
    const std::wstring& name) {
  for (std::size_t i = 0; i + 1 < arguments.size(); ++i) {
    if (arguments[i] == name) {
      return arguments[i + 1];
    }
  }
  return std::nullopt;
}

bool hasOption(
    const std::vector<std::wstring>& arguments,
    const std::wstring& name) {
  return std::find(arguments.begin(), arguments.end(), name) != arguments.end();
}

bool parsePositiveDouble(
    const std::optional<std::wstring>& input,
    double defaultValue,
    double& output,
    std::string& error) {
  if (!input.has_value()) {
    output = defaultValue;
    return true;
  }
  errno = 0;
  wchar_t* end = nullptr;
  output = std::wcstod(input->c_str(), &end);
  if (errno != 0 || end == input->c_str() || end == nullptr || *end != L'\0' ||
      !std::isfinite(output) || output <= 0) {
    error = "Expected a positive numeric option value";
    return false;
  }
  return true;
}

bool sameLayout(
    const irsdk_header& expected,
    const irsdk_header& current) {
  if (expected.ver != current.ver ||
      expected.tickRate != current.tickRate ||
      expected.numVars != current.numVars ||
      expected.varHeaderOffset != current.varHeaderOffset ||
      expected.numBuf != current.numBuf ||
      expected.bufLen != current.bufLen ||
      expected.sessionInfoOffset != current.sessionInfoOffset) {
    return false;
  }
  for (int i = 0; i < expected.numBuf; ++i) {
    if (expected.varBuf[i].bufOffset != current.varBuf[i].bufOffset) {
      return false;
    }
  }
  return true;
}

bool readableMappedRange(
    const char* mappingBase,
    std::uint64_t offset,
    std::uint64_t length) {
  if (mappingBase == nullptr || offset > replay::kMaxMappingSize ||
      length > replay::kMaxMappingSize ||
      offset > replay::kMaxMappingSize - length) {
    return false;
  }

  MEMORY_BASIC_INFORMATION baseInfo{};
  if (VirtualQuery(mappingBase, &baseInfo, sizeof(baseInfo)) == 0) {
    return false;
  }

  const auto start = reinterpret_cast<std::uintptr_t>(mappingBase) + offset;
  const auto end = start + length;
  auto current = start;
  while (current < end) {
    MEMORY_BASIC_INFORMATION info{};
    if (VirtualQuery(
            reinterpret_cast<const void*>(current),
            &info,
            sizeof(info)) == 0 ||
        info.AllocationBase != baseInfo.AllocationBase ||
        info.State != MEM_COMMIT ||
        (info.Protect & (PAGE_NOACCESS | PAGE_GUARD)) != 0) {
      return false;
    }

    const auto regionStart =
        reinterpret_cast<std::uintptr_t>(info.BaseAddress);
    const auto regionEnd = regionStart + info.RegionSize;
    if (regionEnd <= current) {
      return false;
    }
    current = std::min(regionEnd, end);
  }
  return true;
}

std::uint64_t elapsedCounter(const LARGE_INTEGER& start) {
  LARGE_INTEGER now{};
  QueryPerformanceCounter(&now);
  return static_cast<std::uint64_t>(now.QuadPart - start.QuadPart);
}

bool copySessionInfo(
    const char* mapping,
    const irsdk_header* sharedHeader,
    int previousUpdate,
    std::vector<char>& session,
    int& update,
    std::uint64_t& requiredMappingSize,
    std::string& error) {
  for (int attempt = 0; attempt < 3; ++attempt) {
    const int beforeUpdate = sharedHeader->sessionInfoUpdate;
    const int beforeLength = sharedHeader->sessionInfoLen;
    const int beforeOffset = sharedHeader->sessionInfoOffset;

    if (beforeUpdate == previousUpdate) {
      update = previousUpdate;
      return true;
    }
    if (beforeLength < 0 ||
        static_cast<std::uint32_t>(beforeLength) > replay::kMaxPayloadSize ||
        beforeOffset < 0 ||
        !readableMappedRange(
            mapping,
            static_cast<std::uint64_t>(beforeOffset),
            static_cast<std::uint64_t>(beforeLength))) {
      error = "iRacing published invalid session-info metadata";
      return false;
    }

    session.resize(static_cast<std::size_t>(beforeLength));
    if (beforeLength > 0) {
      std::memcpy(
          session.data(),
          mapping + beforeOffset,
          static_cast<std::size_t>(beforeLength));
    }
    MemoryBarrier();

    if (beforeUpdate == sharedHeader->sessionInfoUpdate &&
        beforeLength == sharedHeader->sessionInfoLen &&
        beforeOffset == sharedHeader->sessionInfoOffset) {
      update = beforeUpdate;
      requiredMappingSize = std::max(
          requiredMappingSize,
          static_cast<std::uint64_t>(beforeOffset) +
              static_cast<std::uint64_t>(beforeLength));
      return true;
    }
  }

  error = "Session info changed repeatedly while it was being copied";
  return false;
}

struct MappingReader {
  explicit MappingReader(const SharedObjectNames& objectNames)
      : names(objectNames) {}

  const SharedObjectNames& names;
  HANDLE mappingHandle = nullptr;
  HANDLE eventHandle = nullptr;
  const char* mapping = nullptr;

  ~MappingReader() {
    if (mapping != nullptr) {
      UnmapViewOfFile(mapping);
    }
    if (eventHandle != nullptr) {
      CloseHandle(eventHandle);
    }
    if (mappingHandle != nullptr) {
      CloseHandle(mappingHandle);
    }
  }

  bool connect() {
    mappingHandle = OpenFileMappingW(
        FILE_MAP_READ,
        FALSE,
        names.mapping);
    if (mappingHandle == nullptr) {
      return false;
    }

    mapping = static_cast<const char*>(
        MapViewOfFile(mappingHandle, FILE_MAP_READ, 0, 0, 0));
    if (mapping == nullptr) {
      CloseHandle(mappingHandle);
      mappingHandle = nullptr;
      return false;
    }

    eventHandle = OpenEventW(
        SYNCHRONIZE,
        FALSE,
        names.event);
    if (eventHandle == nullptr) {
      UnmapViewOfFile(mapping);
      CloseHandle(mappingHandle);
      mapping = nullptr;
      mappingHandle = nullptr;
      return false;
    }
    return true;
  }
};

int recordTelemetry(const std::vector<std::wstring>& arguments) {
  const auto output = optionValue(arguments, L"--output");
  if (!output.has_value()) {
    std::cerr << "record requires --output <capture.irdt>\n";
    return 2;
  }

  double durationSeconds = 0;
  std::string error;
  const auto durationOption = optionValue(arguments, L"--duration");
  if (durationOption.has_value() &&
      !parsePositiveDouble(durationOption, 0, durationSeconds, error)) {
    std::cerr << error << '\n';
    return 2;
  }

  std::cout << "Waiting for iRacing shared memory...\n";
  std::cout.flush();

  MappingReader reader(kIRacingObjectNames);
  while (!stopRequested.load() && !reader.connect()) {
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
  }
  if (stopRequested.load()) {
    return 130;
  }

  const auto* sharedHeader =
      reinterpret_cast<const irsdk_header*>(reader.mapping);
  while (!stopRequested.load() &&
         (sharedHeader->status & irsdk_stConnected) == 0) {
    WaitForSingleObject(reader.eventHandle, 250);
  }
  if (stopRequested.load()) {
    return 130;
  }

  irsdk_header header{};
  std::vector<irsdk_varHeader> variables;
  std::uint64_t mappingSize = 0;
  bool capturedLayout = false;

  for (int attempt = 0; attempt < 10 && !capturedLayout; ++attempt) {
    std::memcpy(&header, sharedHeader, sizeof(header));
    if (header.numVars <= 0 || header.numVars > 4096 ||
        header.varHeaderOffset < 0 ||
        !readableMappedRange(
            reader.mapping,
            static_cast<std::uint64_t>(header.varHeaderOffset),
            static_cast<std::uint64_t>(header.numVars) *
                sizeof(irsdk_varHeader))) {
      WaitForSingleObject(reader.eventHandle, 16);
      continue;
    }

    variables.resize(static_cast<std::size_t>(header.numVars));
    std::memcpy(
        variables.data(),
        reader.mapping + header.varHeaderOffset,
        variables.size() * sizeof(irsdk_varHeader));
    MemoryBarrier();

    irsdk_header after{};
    std::memcpy(&after, sharedHeader, sizeof(after));
    capturedLayout =
        sameLayout(header, after) &&
        replay::validateSdkLayout(header, variables, mappingSize, error);
    if (!capturedLayout) {
      WaitForSingleObject(reader.eventHandle, 16);
    }
  }

  if (!capturedLayout) {
    std::cerr << "Could not capture a stable SDK layout";
    if (!error.empty()) {
      std::cerr << ": " << error;
    }
    std::cerr << '\n';
    return 1;
  }
  error.clear();

  LARGE_INTEGER frequency{};
  LARGE_INTEGER start{};
  QueryPerformanceFrequency(&frequency);
  QueryPerformanceCounter(&start);

  replay::TapeWriter writer;
  if (!writer.open(
          std::filesystem::path(*output),
          header,
          variables,
          mappingSize,
          static_cast<std::uint64_t>(frequency.QuadPart),
          error)) {
    std::cerr << error << '\n';
    return 1;
  }

  std::vector<char> session;
  int lastSessionUpdate = std::numeric_limits<int>::min();
  int currentSessionUpdate = lastSessionUpdate;
  if (!copySessionInfo(
          reader.mapping,
          sharedHeader,
          lastSessionUpdate,
          session,
          currentSessionUpdate,
          mappingSize,
          error) ||
      !writer.append(
          replay::RecordKind::SessionInfo,
          elapsedCounter(start),
          -1,
          currentSessionUpdate,
          session.empty() ? nullptr : session.data(),
          static_cast<std::uint32_t>(session.size()),
          error)) {
    std::cerr << error << '\n';
    return 1;
  }
  lastSessionUpdate = currentSessionUpdate;

  int lastTick = std::numeric_limits<int>::min();
  for (int i = 0; i < header.numBuf; ++i) {
    lastTick = std::max(lastTick, sharedHeader->varBuf[i].tickCount);
  }

  std::vector<char> frame(static_cast<std::size_t>(header.bufLen));
  std::uint64_t frameCount = 0;
  std::uint64_t gapCount = 0;
  auto lastProgress = std::chrono::steady_clock::now();

  struct Candidate {
    int index;
    int tick;
  };
  std::array<Candidate, IRSDK_MAX_BUFS> candidates{};

  bool disconnected = false;
  while (!stopRequested.load()) {
    if (durationSeconds > 0) {
      const auto elapsedSeconds =
          static_cast<double>(elapsedCounter(start)) /
          static_cast<double>(frequency.QuadPart);
      if (elapsedSeconds >= durationSeconds) {
        break;
      }
    }

    WaitForSingleObject(reader.eventHandle, 16);
    MemoryBarrier();

    irsdk_header currentHeader{};
    std::memcpy(&currentHeader, sharedHeader, sizeof(currentHeader));
    if ((currentHeader.status & irsdk_stConnected) == 0) {
      if (!writer.append(
              replay::RecordKind::Disconnect,
              elapsedCounter(start),
              lastTick,
              0,
              nullptr,
              0,
              error)) {
        break;
      }
      disconnected = true;
      break;
    }
    if (!sameLayout(header, currentHeader)) {
      error =
          "The SDK layout changed during recording; start a new capture for "
          "the new connection";
      break;
    }

    if (!copySessionInfo(
            reader.mapping,
            sharedHeader,
            lastSessionUpdate,
            session,
            currentSessionUpdate,
            mappingSize,
            error)) {
      break;
    }
    if (currentSessionUpdate != lastSessionUpdate) {
      if (!writer.append(
              replay::RecordKind::SessionInfo,
              elapsedCounter(start),
              lastTick,
              currentSessionUpdate,
              session.empty() ? nullptr : session.data(),
              static_cast<std::uint32_t>(session.size()),
              error)) {
        break;
      }
      lastSessionUpdate = currentSessionUpdate;
    }

    int candidateCount = 0;
    for (int i = 0; i < header.numBuf; ++i) {
      const int tick = sharedHeader->varBuf[i].tickCount;
      if (tick > lastTick) {
        candidates[static_cast<std::size_t>(candidateCount++)] = {i, tick};
      }
    }
    std::sort(
        candidates.begin(),
        candidates.begin() + candidateCount,
        [](const Candidate& left, const Candidate& right) {
          return left.tick < right.tick;
        });

    for (int candidateIndex = 0;
         candidateIndex < candidateCount;
         ++candidateIndex) {
      const auto candidate =
          candidates[static_cast<std::size_t>(candidateIndex)];
      if (candidate.tick <= lastTick) {
        continue;
      }

      const auto& buffer = sharedHeader->varBuf[candidate.index];
      bool copied = false;
      for (int attempt = 0; attempt < 3; ++attempt) {
        const int beforeTick = buffer.tickCount;
        if (beforeTick != candidate.tick ||
            buffer.bufOffset < 0 ||
            !readableMappedRange(
                reader.mapping,
                static_cast<std::uint64_t>(buffer.bufOffset),
                frame.size())) {
          break;
        }
        std::memcpy(
            frame.data(),
            reader.mapping + buffer.bufOffset,
            frame.size());
        MemoryBarrier();
        if (beforeTick == buffer.tickCount) {
          copied = true;
          break;
        }
      }
      if (!copied) {
        continue;
      }

      if (lastTick != std::numeric_limits<int>::min() &&
          candidate.tick > lastTick + 1) {
        const int missed = candidate.tick - lastTick - 1;
        if (!writer.append(
                replay::RecordKind::Gap,
                elapsedCounter(start),
                candidate.tick,
                missed,
                nullptr,
                0,
                error)) {
          break;
        }
        gapCount += static_cast<std::uint64_t>(missed);
      }

      if (!writer.append(
              replay::RecordKind::Frame,
              elapsedCounter(start),
              candidate.tick,
              candidate.index,
              frame.data(),
              static_cast<std::uint32_t>(frame.size()),
              error)) {
        break;
      }
      lastTick = candidate.tick;
      ++frameCount;
    }
    if (!error.empty()) {
      break;
    }

    const auto now = std::chrono::steady_clock::now();
    if (now - lastProgress >= std::chrono::seconds(1)) {
      std::cout << "Recorded " << frameCount << " frames";
      if (gapCount > 0) {
        std::cout << " (" << gapCount << " source ticks missed)";
      }
      std::cout << "\r";
      std::cout.flush();
      lastProgress = now;
    }
  }

  if (!writer.append(
          replay::RecordKind::End,
          elapsedCounter(start),
          lastTick,
          disconnected ? 1 : 0,
          nullptr,
          0,
          error) ||
      !writer.finish(mappingSize, error)) {
    std::cerr << '\n' << error << '\n';
    return 1;
  }

  if (!error.empty()) {
    std::cerr << '\n' << error << '\n';
    return 1;
  }
  std::cout << "\nCapture complete: " << frameCount << " frames, "
            << gapCount << " missed source ticks, "
            << writer.recordCount() << " records\n";
  return 0;
}

class SharedPublisher {
 public:
  ~SharedPublisher() {
    disconnect();
    if (mapping_ != nullptr) {
      UnmapViewOfFile(mapping_);
    }
    if (eventHandle_ != nullptr) {
      CloseHandle(eventHandle_);
    }
    if (mappingHandle_ != nullptr) {
      CloseHandle(mappingHandle_);
    }
  }

  bool initialize(
      const replay::TapeReader& tape,
      const SharedObjectNames& names,
      std::string& error) {
    HANDLE existingMapping = OpenFileMappingW(
        FILE_MAP_READ,
        FALSE,
        names.mapping);
    if (existingMapping != nullptr) {
      CloseHandle(existingMapping);
      error = std::string("The ") + names.owner +
          " shared-memory name is already in use";
      return false;
    }

    const auto mappingSize = tape.fileHeader().mappingSize;
    mappingHandle_ = CreateFileMappingW(
        INVALID_HANDLE_VALUE,
        nullptr,
        PAGE_READWRITE,
        static_cast<DWORD>(mappingSize >> 32U),
        static_cast<DWORD>(mappingSize & 0xffffffffU),
        names.mapping);
    if (mappingHandle_ == nullptr) {
      error = windowsError("CreateFileMapping");
      return false;
    }
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
      error = "The iRacing shared-memory mapping appeared during startup";
      return false;
    }

    mapping_ = static_cast<char*>(
        MapViewOfFile(mappingHandle_, FILE_MAP_ALL_ACCESS, 0, 0, 0));
    if (mapping_ == nullptr) {
      error = windowsError("MapViewOfFile");
      return false;
    }

    eventHandle_ = CreateEventW(
        nullptr,
        FALSE,
        FALSE,
        names.event);
    if (eventHandle_ == nullptr) {
      error = windowsError("CreateEvent");
      return false;
    }
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
      error = std::string("The ") + names.owner +
          " data-valid event is already in use";
      return false;
    }

    mappingSize_ = mappingSize;
    std::memset(mapping_, 0, static_cast<std::size_t>(mappingSize_));
    std::memcpy(mapping_, &tape.sdkHeader(), sizeof(irsdk_header));
    header_ = reinterpret_cast<irsdk_header*>(mapping_);
    header_->status = 0;
    header_->sessionInfoLen = 0;
    header_->sessionInfoUpdate = 0;
    for (int i = 0; i < header_->numBuf; ++i) {
      header_->varBuf[i].tickCount = -1;
    }
    std::memcpy(
        mapping_ + header_->varHeaderOffset,
        tape.variables().data(),
        tape.variables().size() * sizeof(irsdk_varHeader));
    MemoryBarrier();
    return true;
  }

  bool applySession(
      const replay::TapeRecordHeader& record,
      const std::vector<char>& payload,
      std::string& error) {
    const auto offset =
        static_cast<std::uint64_t>(header_->sessionInfoOffset);
    const auto previousLength =
        static_cast<std::size_t>(std::max(header_->sessionInfoLen, 0));
    const auto clearLength = std::max(previousLength, payload.size());
    const auto end = offset + clearLength;
    if (offset >= mappingSize_ ||
        clearLength > mappingSize_ - offset ||
        overlapsUsedRegion(offset, end)) {
      error = "Session-info record exceeds the replay mapping";
      return false;
    }

    std::memset(
        mapping_ + header_->sessionInfoOffset,
        0,
        clearLength);
    if (!payload.empty()) {
      std::memcpy(
          mapping_ + header_->sessionInfoOffset,
          payload.data(),
          payload.size());
    }
    MemoryBarrier();
    header_->sessionInfoLen = static_cast<int>(payload.size());
    header_->sessionInfoUpdate = record.value;
    MemoryBarrier();
    return true;
  }

  bool publishFrame(
      const std::vector<char>& payload,
      std::string& error) {
    if (payload.size() != static_cast<std::size_t>(header_->bufLen)) {
      error = "Frame record length does not match the SDK buffer length";
      return false;
    }

    const int target = nextBuffer_;
    auto& buffer = header_->varBuf[target];
    const auto offset = static_cast<std::uint64_t>(buffer.bufOffset);
    if (offset >= mappingSize_ ||
        payload.size() > mappingSize_ - offset) {
      error = "Frame record exceeds the replay mapping";
      return false;
    }

    std::memcpy(mapping_ + buffer.bufOffset, payload.data(), payload.size());
    if (!connected_) {
      header_->status = irsdk_stConnected;
      connected_ = true;
    }
    MemoryBarrier();
    buffer.tickCount = nextPublishedTick_++;
    MemoryBarrier();
    SetEvent(eventHandle_);
    nextBuffer_ = (nextBuffer_ + 1) % header_->numBuf;
    return true;
  }

  void disconnect() {
    if (header_ != nullptr && connected_) {
      header_->status = 0;
      MemoryBarrier();
      if (eventHandle_ != nullptr) {
        SetEvent(eventHandle_);
      }
      connected_ = false;
    }
  }

 private:
  static bool overlaps(
      std::uint64_t leftStart,
      std::uint64_t leftEnd,
      std::uint64_t rightStart,
      std::uint64_t rightEnd) {
    return leftStart < rightEnd && rightStart < leftEnd;
  }

  bool overlapsUsedRegion(
      std::uint64_t sessionStart,
      std::uint64_t sessionEnd) const {
    if (overlaps(
            sessionStart,
            sessionEnd,
            0,
            sizeof(irsdk_header))) {
      return true;
    }
    const auto variableStart =
        static_cast<std::uint64_t>(header_->varHeaderOffset);
    const auto variableEnd =
        variableStart +
        static_cast<std::uint64_t>(header_->numVars) *
            sizeof(irsdk_varHeader);
    if (overlaps(
            sessionStart,
            sessionEnd,
            variableStart,
            variableEnd)) {
      return true;
    }
    for (int i = 0; i < header_->numBuf; ++i) {
      const auto bufferStart =
          static_cast<std::uint64_t>(header_->varBuf[i].bufOffset);
      const auto bufferEnd =
          bufferStart + static_cast<std::uint64_t>(header_->bufLen);
      if (overlaps(
              sessionStart,
              sessionEnd,
              bufferStart,
              bufferEnd)) {
        return true;
      }
    }
    return false;
  }

  HANDLE mappingHandle_ = nullptr;
  HANDLE eventHandle_ = nullptr;
  char* mapping_ = nullptr;
  irsdk_header* header_ = nullptr;
  std::uint64_t mappingSize_ = 0;
  int nextBuffer_ = 0;
  int nextPublishedTick_ = 0;
  bool connected_ = false;
};

bool waitForStepCommand() {
  std::string command;
  while (!stopRequested.load() && std::getline(std::cin, command)) {
    if (command == "next" || command.empty()) {
      return true;
    }
    if (command == "quit" || command == "exit") {
      stopRequested.store(true);
      return false;
    }
    std::cout << "COMMANDS next|quit\n";
    std::cout.flush();
  }
  stopRequested.store(true);
  return false;
}

void waitForPlaybackTime(
    const replay::TapeFileHeader& fileHeader,
    const replay::TapeRecordHeader& record,
    double speed,
    const std::chrono::steady_clock::time_point& playbackStart) {
  const auto seconds =
      static_cast<double>(record.elapsedTicks) /
      static_cast<double>(fileHeader.qpcFrequency) /
      speed;
  const auto target =
      playbackStart + std::chrono::duration_cast<std::chrono::steady_clock::duration>(
                          std::chrono::duration<double>(seconds));
  std::this_thread::sleep_until(target);
}

int playTelemetry(const std::vector<std::wstring>& arguments) {
  const auto input = optionValue(arguments, L"--input");
  if (!input.has_value()) {
    std::cerr << "play requires --input <capture.irdt>\n";
    return 2;
  }

  double speed = 1;
  std::string error;
  if (!parsePositiveDouble(optionValue(arguments, L"--speed"), 1, speed, error)) {
    std::cerr << error << '\n';
    return 2;
  }
  const bool stepMode = hasOption(arguments, L"--step");
  const bool loop = hasOption(arguments, L"--loop");
  const bool useIRacingNames = hasOption(arguments, L"--iracing-names");
  const auto& objectNames = useIRacingNames
      ? kIRacingObjectNames
      : kIsolatedReplayObjectNames;

  replay::TapeReader tape;
  if (!tape.open(std::filesystem::path(*input), error)) {
    std::cerr << error << '\n';
    return 1;
  }

  SharedPublisher publisher;
  if (!publisher.initialize(tape, objectNames, error)) {
    std::cerr << error << '\n';
    return 1;
  }

  std::cout << "READY\n";
  if (useIRacingNames) {
    std::cout
        << "WARNING using production iRacing object names; do not start "
           "iRacing during playback\n";
  }
  std::cout.flush();

  std::uint64_t publishedFrames = 0;
  do {
    const auto playbackStart = std::chrono::steady_clock::now();
    replay::TapeRecordHeader record{};
    std::vector<char> payload;
    struct PendingSession {
      replay::TapeRecordHeader record;
      std::vector<char> payload;
    };
    std::vector<PendingSession> pendingSessions;
    bool hasPublishedFrame = false;
    bool reachedEnd = false;

    while (!stopRequested.load() && !reachedEnd) {
      const auto result = tape.readNext(record, payload, error);
      if (result == replay::TapeReadResult::EndOfFile) {
        reachedEnd = true;
        break;
      }
      if (result == replay::TapeReadResult::Error) {
        std::cerr << error << '\n';
        return 1;
      }

      const auto kind = static_cast<replay::RecordKind>(record.kind);
      if (!stepMode) {
        waitForPlaybackTime(
            tape.fileHeader(),
            record,
            speed,
            playbackStart);
      }

      switch (kind) {
        case replay::RecordKind::SessionInfo:
          if (stepMode && hasPublishedFrame) {
            pendingSessions.push_back({record, payload});
            break;
          }
          if (!publisher.applySession(record, payload, error)) {
            std::cerr << error << '\n';
            return 1;
          }
          break;

        case replay::RecordKind::Frame:
          if (stepMode && !waitForStepCommand()) {
            reachedEnd = true;
            break;
          }
          for (const auto& pending : pendingSessions) {
            if (!publisher.applySession(
                    pending.record,
                    pending.payload,
                    error)) {
              std::cerr << error << '\n';
              return 1;
            }
          }
          pendingSessions.clear();
          if (!publisher.publishFrame(payload, error)) {
            std::cerr << error << '\n';
            return 1;
          }
          ++publishedFrames;
          hasPublishedFrame = true;
          if (stepMode) {
            std::cout << "FRAME " << publishedFrames << " "
                      << record.sourceTick << '\n';
            std::cout.flush();
          } else if (publishedFrames % 60 == 0) {
            std::cout << "Published " << publishedFrames << " frames\r";
            std::cout.flush();
          }
          break;

        case replay::RecordKind::Gap:
          std::cerr << "Capture gap: " << record.value
                    << " source ticks before " << record.sourceTick << '\n';
          break;

        case replay::RecordKind::Disconnect:
          if (stepMode && !waitForStepCommand()) {
            reachedEnd = true;
            break;
          }
          publisher.disconnect();
          reachedEnd = true;
          break;

        case replay::RecordKind::End:
          if (stepMode && !waitForStepCommand()) {
            reachedEnd = true;
            break;
          }
          reachedEnd = true;
          break;
      }
    }

    if (!loop || stopRequested.load()) {
      break;
    }

    publisher.disconnect();
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    if (!tape.rewindRecords(error)) {
      std::cerr << error << '\n';
      return 1;
    }
  } while (!stopRequested.load());

  publisher.disconnect();
  std::cout << "\nDONE " << publishedFrames << '\n';
  std::cout.flush();
  return 0;
}

void setVariable(
    irsdk_varHeader& variable,
    int type,
    int offset,
    int count,
    const char* name,
    const char* description,
    const char* unit) {
  std::memset(&variable, 0, sizeof(variable));
  variable.type = type;
  variable.offset = offset;
  variable.count = count;
  std::snprintf(variable.name, sizeof(variable.name), "%s", name);
  std::snprintf(variable.desc, sizeof(variable.desc), "%s", description);
  std::snprintf(variable.unit, sizeof(variable.unit), "%s", unit);
}

template <typename T>
void writeValue(std::vector<char>& frame, int offset, const T& value) {
  std::memcpy(frame.data() + offset, &value, sizeof(value));
}

int createFixture(const std::vector<std::wstring>& arguments) {
  const auto output = optionValue(arguments, L"--output");
  if (!output.has_value()) {
    std::cerr << "fixture requires --output <fixture.irdt>\n";
    return 2;
  }

  std::vector<irsdk_varHeader> variables(7);
  setVariable(
      variables[0],
      irsdk_double,
      0,
      1,
      "SessionTime",
      "Seconds since session start",
      "s");
  setVariable(
      variables[1],
      irsdk_int,
      8,
      1,
      "SessionTick",
      "Current update number",
      "");
  setVariable(
      variables[2],
      irsdk_bool,
      12,
      1,
      "IsOnTrack",
      "Player is on track",
      "");
  setVariable(
      variables[3],
      irsdk_bitField,
      16,
      1,
      "SessionFlags",
      "Session flags",
      "irsdk_Flags");
  setVariable(
      variables[4],
      irsdk_float,
      20,
      1,
      "Speed",
      "Player speed",
      "m/s");
  setVariable(
      variables[5],
      irsdk_float,
      24,
      3,
      "CarIdxLapDistPct",
      "Car positions",
      "%");
  setVariable(
      variables[6],
      irsdk_char,
      36,
      4,
      "ReplayMarker",
      "Synthetic marker bytes",
      "");

  constexpr int kFrameLength = 48;
  constexpr int kSessionCapacity = 1024;
  const int variableOffset = static_cast<int>(sizeof(irsdk_header));
  const int sessionOffset =
      variableOffset +
      static_cast<int>(variables.size() * sizeof(irsdk_varHeader));
  const int firstBufferOffset = sessionOffset + kSessionCapacity;

  irsdk_header header{};
  header.ver = IRSDK_VER;
  header.status = irsdk_stConnected;
  header.tickRate = 60;
  header.sessionInfoUpdate = 1;
  header.numVars = static_cast<int>(variables.size());
  header.varHeaderOffset = variableOffset;
  header.numBuf = 3;
  header.bufLen = kFrameLength;
  for (int i = 0; i < header.numBuf; ++i) {
    header.varBuf[i].tickCount = -1;
    header.varBuf[i].bufOffset = firstBufferOffset + i * kFrameLength;
  }

  const std::string firstSession =
      "WeekendInfo:\n"
      "  TrackName: Replay Test Track\n"
      "DriverInfo:\n"
      "  DriverCarIdx: 1\n";
  const std::string secondSession =
      "WeekendInfo:\n"
      "  TrackName: Replay Test Track\n"
      "DriverInfo:\n"
      "  DriverCarIdx: 1\n"
      "SessionInfo:\n"
      "  Sessions:\n"
      "    - SessionNum: 0\n";
  header.sessionInfoLen = static_cast<int>(firstSession.size() + 1U);
  header.sessionInfoOffset = sessionOffset;

  const std::uint64_t mappingSize =
      static_cast<std::uint64_t>(firstBufferOffset) +
      static_cast<std::uint64_t>(header.numBuf * kFrameLength);
  constexpr std::uint64_t kSyntheticFrequency = 1000000000ULL;

  std::string error;
  replay::TapeWriter writer;
  if (!writer.open(
          std::filesystem::path(*output),
          header,
          variables,
          mappingSize,
          kSyntheticFrequency,
          error) ||
      !writer.append(
          replay::RecordKind::SessionInfo,
          0,
          -1,
          1,
          firstSession.c_str(),
          static_cast<std::uint32_t>(firstSession.size() + 1U),
          error)) {
    std::cerr << error << '\n';
    return 1;
  }

  std::vector<char> frame(kFrameLength);
  const std::array<std::array<float, 3>, 3> positions = {{
      {{0.10F, 0.20F, 0.30F}},
      {{0.11F, 0.21F, 0.31F}},
      {{0.12F, 0.22F, 0.32F}},
  }};
  for (int index = 0; index < 3; ++index) {
    std::fill(frame.begin(), frame.end(), 0);
    const double sessionTime = 10.0 + index / 60.0;
    const int sessionTick = 100 + index;
    const bool isOnTrack = true;
    const int flags = index == 2 ? irsdk_checkered : irsdk_green;
    const float speed = 50.0F + static_cast<float>(index);
    writeValue(frame, 0, sessionTime);
    writeValue(frame, 8, sessionTick);
    writeValue(frame, 12, isOnTrack);
    writeValue(frame, 16, flags);
    writeValue(frame, 20, speed);
    std::memcpy(
        frame.data() + 24,
        positions[static_cast<std::size_t>(index)].data(),
        sizeof(float) * 3);
    const std::array<char, 4> marker = {
        'T', '0', static_cast<char>('0' + index), '\0'};
    std::memcpy(frame.data() + 36, marker.data(), marker.size());

    if (index == 2 &&
        !writer.append(
            replay::RecordKind::SessionInfo,
            2 * (kSyntheticFrequency / 60),
            101,
            2,
            secondSession.c_str(),
            static_cast<std::uint32_t>(secondSession.size() + 1U),
            error)) {
      std::cerr << error << '\n';
      return 1;
    }

    if (!writer.append(
            replay::RecordKind::Frame,
            static_cast<std::uint64_t>(index) *
                (kSyntheticFrequency / 60),
            100 + index,
            index % header.numBuf,
            frame.data(),
            static_cast<std::uint32_t>(frame.size()),
            error)) {
      std::cerr << error << '\n';
      return 1;
    }
  }

  if (!writer.append(
          replay::RecordKind::End,
          3 * (kSyntheticFrequency / 60),
          102,
          0,
          nullptr,
          0,
          error) ||
      !writer.finish(mappingSize, error)) {
    std::cerr << error << '\n';
    return 1;
  }

  std::cout << "Fixture created with " << writer.recordCount()
            << " records\n";
  return 0;
}

int inspectTape(const std::vector<std::wstring>& arguments) {
  const auto input = optionValue(arguments, L"--input");
  if (!input.has_value()) {
    std::cerr << "inspect requires --input <capture.irdt>\n";
    return 2;
  }

  replay::TapeReader tape;
  std::string error;
  if (!tape.open(std::filesystem::path(*input), error)) {
    std::cerr << error << '\n';
    return 1;
  }

  std::array<std::uint64_t, 6> counts{};
  replay::TapeRecordHeader record{};
  std::vector<char> payload;
  while (true) {
    const auto result = tape.readNext(record, payload, error);
    if (result == replay::TapeReadResult::EndOfFile) {
      break;
    }
    if (result == replay::TapeReadResult::Error) {
      std::cerr << error << '\n';
      return 1;
    }
    if (record.kind < counts.size()) {
      ++counts[record.kind];
    }
  }

  std::cout << "Format version: " << tape.fileHeader().formatVersion << '\n'
            << "SDK version: " << tape.sdkHeader().ver << '\n'
            << "Tick rate: " << tape.sdkHeader().tickRate << " Hz\n"
            << "Variables: " << tape.variables().size() << '\n'
            << "Frame bytes: " << tape.sdkHeader().bufLen << '\n'
            << "Mapping bytes: " << tape.fileHeader().mappingSize << '\n'
            << "Records: " << tape.fileHeader().recordCount << '\n'
            << "Frames: "
            << counts[static_cast<std::size_t>(replay::RecordKind::Frame)]
            << '\n'
            << "Session updates: "
            << counts[
                   static_cast<std::size_t>(
                       replay::RecordKind::SessionInfo)]
            << '\n'
            << "Gap records: "
            << counts[static_cast<std::size_t>(replay::RecordKind::Gap)]
            << '\n';
  return 0;
}

void printUsage() {
  std::cout
      << "irDashies iRacing telemetry record/replay tool\n\n"
      << "Commands:\n"
      << "  record  --output <capture.irdt> [--duration <seconds>]\n"
      << "  play    --input <capture.irdt> [--speed <factor>] [--loop] "
         "[--step] [--iracing-names]\n"
      << "  inspect --input <capture.irdt>\n"
      << "  fixture --output <fixture.irdt>\n\n"
      << "Step mode reads 'next' and 'quit' commands from stdin.\n";
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  SetConsoleCtrlHandler(handleConsoleSignal, TRUE);

  std::vector<std::wstring> arguments;
  arguments.reserve(static_cast<std::size_t>(argc));
  for (int i = 0; i < argc; ++i) {
    arguments.emplace_back(argv[i]);
  }

  if (arguments.size() < 2 || arguments[1] == L"--help" ||
      arguments[1] == L"-h") {
    printUsage();
    return arguments.size() < 2 ? 2 : 0;
  }

  if (arguments[1] == L"record") {
    return recordTelemetry(arguments);
  }
  if (arguments[1] == L"play") {
    return playTelemetry(arguments);
  }
  if (arguments[1] == L"inspect") {
    return inspectTape(arguments);
  }
  if (arguments[1] == L"fixture") {
    return createFixture(arguments);
  }

  printUsage();
  return 2;
}
