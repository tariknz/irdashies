#include "./irsdk_tape.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace replay = irdashies::irsdk_replay;

namespace {

enum class PlaybackState {
  Stopped,
  Playing,
  NeedsDisconnectSignal,
  ReadyToLoop,
  Finished,
  Failed,
};

std::unique_ptr<replay::TapeReader> tape;
irsdk_header header{};
std::vector<char> frame;
std::vector<char> session;
replay::TapeRecordHeader pendingRecord{};
std::vector<char> pendingPayload;
bool hasPendingRecord = false;
PlaybackState state = PlaybackState::Stopped;
std::chrono::steady_clock::time_point playbackStart;
double playbackSpeed = 1.0;
bool loopPlayback = false;

bool parsePlaybackOptions(std::string& error) {
  const char* speedText = std::getenv("IRDASHIES_TELEMETRY_REPLAY_SPEED");
  if (speedText != nullptr && speedText[0] != '\0') {
    char* end = nullptr;
    const double parsed = std::strtod(speedText, &end);
    if (end == speedText || end == nullptr || *end != '\0' ||
        !std::isfinite(parsed) || parsed < 0.25 || parsed > 100.0) {
      error = "IRDASHIES_TELEMETRY_REPLAY_SPEED must be between 0.25 and 100";
      return false;
    }
    playbackSpeed = parsed;
  } else {
    playbackSpeed = 1.0;
  }

  const char* loopText = std::getenv("IRDASHIES_TELEMETRY_REPLAY_LOOP");
  loopPlayback = loopText != nullptr && std::strcmp(loopText, "1") == 0;
  return true;
}

void resetPublishedData() {
  header = tape->sdkHeader();
  header.status = irsdk_stConnected;
  header.sessionInfoLen = 0;
  header.sessionInfoUpdate = -1;
  for (int i = 0; i < header.numBuf; ++i) {
    header.varBuf[i].tickCount = -1;
  }
  frame.assign(static_cast<std::size_t>(header.bufLen), 0);
  session.assign(1, '\0');
  hasPendingRecord = false;
  pendingPayload.clear();
  playbackStart = std::chrono::steady_clock::now();
  state = PlaybackState::Playing;
}

bool openTape(std::string& error) {
  const char* input = std::getenv("IRDASHIES_TELEMETRY_REPLAY");
  if (input == nullptr || input[0] == '\0') {
    error = "IRDASHIES_TELEMETRY_REPLAY is not set";
    return false;
  }
  if (!parsePlaybackOptions(error)) {
    return false;
  }

  auto candidate = std::make_unique<replay::TapeReader>();
  if (!candidate->open(std::filesystem::path(input), error)) {
    return false;
  }
  tape = std::move(candidate);
  resetPublishedData();
  return true;
}

bool restartTape(std::string& error) {
  if (tape == nullptr || !tape->rewindRecords(error)) {
    return false;
  }
  resetPublishedData();
  return true;
}

void finishPlayback(bool frameWillBePublished) {
  header.status = 0;
  if (!loopPlayback) {
    state = PlaybackState::Finished;
  } else {
    state = frameWillBePublished
        ? PlaybackState::NeedsDisconnectSignal
        : PlaybackState::ReadyToLoop;
  }
}

bool loadPendingRecord(bool frameWillBePublished, std::string& error) {
  if (hasPendingRecord) {
    return true;
  }
  const auto result = tape->readNext(pendingRecord, pendingPayload, error);
  if (result == replay::TapeReadResult::Record) {
    hasPendingRecord = true;
    return true;
  }
  if (result == replay::TapeReadResult::EndOfFile) {
    finishPlayback(frameWillBePublished);
    return false;
  }
  state = PlaybackState::Failed;
  header.status = 0;
  return false;
}

std::chrono::steady_clock::time_point pendingTargetTime() {
  const double seconds =
      static_cast<double>(pendingRecord.elapsedTicks) /
      static_cast<double>(tape->fileHeader().qpcFrequency) /
      playbackSpeed;
  return playbackStart +
      std::chrono::duration_cast<std::chrono::steady_clock::duration>(
          std::chrono::duration<double>(seconds));
}

void applySessionRecord() {
  session.resize(pendingPayload.size() + 1);
  if (!pendingPayload.empty()) {
    std::memcpy(session.data(), pendingPayload.data(), pendingPayload.size());
  }
  session.back() = '\0';
  header.sessionInfoLen = static_cast<int>(pendingPayload.size());
  header.sessionInfoUpdate = pendingRecord.value;
}

bool publishFrameRecord(char* destination, std::string& error) {
  if (pendingPayload.size() != frame.size()) {
    error = "Frame record length does not match the SDK buffer length";
    state = PlaybackState::Failed;
    header.status = 0;
    return false;
  }
  std::memcpy(frame.data(), pendingPayload.data(), frame.size());
  if (destination != nullptr) {
    std::memcpy(destination, frame.data(), frame.size());
  }
  return true;
}

bool readTimedFrame(int timeoutMs, char* destination) {
  bool foundFrame = false;
  std::string error;
  const auto deadline = std::chrono::steady_clock::now() +
      std::chrono::milliseconds(std::max(timeoutMs, 0));

  while (state == PlaybackState::Playing) {
    if (!loadPendingRecord(foundFrame, error)) {
      if (!error.empty()) {
        std::cerr << "Telemetry tape playback failed: " << error << '\n';
      }
      return foundFrame;
    }

    const auto target = pendingTargetTime();
    const auto now = std::chrono::steady_clock::now();
    if (target > now) {
      if (foundFrame || now >= deadline) {
        return foundFrame;
      }
      std::this_thread::sleep_for(std::min(target - now, deadline - now));
      continue;
    }

    const auto kind = static_cast<replay::RecordKind>(pendingRecord.kind);
    switch (kind) {
      case replay::RecordKind::Frame:
        if (!publishFrameRecord(destination, error)) {
          std::cerr << "Telemetry tape playback failed: " << error << '\n';
          return false;
        }
        foundFrame = true;
        break;

      case replay::RecordKind::SessionInfo:
        applySessionRecord();
        break;

      case replay::RecordKind::Gap:
        std::cerr << "Telemetry tape capture gap: " << pendingRecord.value
                  << " source ticks\n";
        break;

      case replay::RecordKind::Disconnect:
      case replay::RecordKind::End:
        finishPlayback(foundFrame);
        break;
    }
    hasPendingRecord = false;
  }

  return foundFrame;
}

}  // namespace

bool irsdk_startup() {
  if (state == PlaybackState::Playing) {
    return true;
  }
  if (state == PlaybackState::NeedsDisconnectSignal) {
    state = loopPlayback
        ? PlaybackState::ReadyToLoop
        : PlaybackState::Finished;
    return false;
  }

  std::string error;
  if (state == PlaybackState::ReadyToLoop) {
    if (restartTape(error)) {
      return true;
    }
  } else if (state == PlaybackState::Stopped) {
    if (openTape(error)) {
      return true;
    }
  } else {
    return false;
  }

  std::cerr << "Could not start telemetry tape playback: " << error << '\n';
  state = PlaybackState::Failed;
  return false;
}

void irsdk_shutdown() {
  tape.reset();
  frame.clear();
  session.clear();
  pendingPayload.clear();
  hasPendingRecord = false;
  header = {};
  state = PlaybackState::Stopped;
}

bool irsdk_getNewData(char* data) {
  return readTimedFrame(1, data);
}

bool irsdk_waitForDataReady(int timeoutMs, char* data) {
  if (state != PlaybackState::Playing && !irsdk_startup()) {
    return false;
  }
  return readTimedFrame(timeoutMs, data);
}

bool irsdk_isConnected() {
  return state == PlaybackState::Playing &&
      (header.status & irsdk_stConnected) != 0;
}

const irsdk_header* irsdk_getHeader() {
  return tape == nullptr ? nullptr : &header;
}

const char* irsdk_getData(int index) {
  if (index < 0 || index >= header.numBuf || frame.empty()) {
    return nullptr;
  }
  return frame.data();
}

const char* irsdk_getSessionInfoStr() {
  return session.empty() ? nullptr : session.data();
}

int irsdk_getSessionInfoStrUpdate() {
  return session.size() <= 1 ? -1 : header.sessionInfoUpdate;
}

const irsdk_varHeader* irsdk_getVarHeaderPtr() {
  if (tape == nullptr || tape->variables().empty()) {
    return nullptr;
  }
  return tape->variables().data();
}

const irsdk_varHeader* irsdk_getVarHeaderEntry(int index) {
  if (tape == nullptr || index < 0 ||
      index >= static_cast<int>(tape->variables().size())) {
    return nullptr;
  }
  return &tape->variables()[static_cast<std::size_t>(index)];
}

int irsdk_varNameToIndex(const char* name) {
  if (name == nullptr || tape == nullptr) {
    return -1;
  }
  const auto& variables = tape->variables();
  for (std::size_t index = 0; index < variables.size(); ++index) {
    if (std::strncmp(name, variables[index].name, IRSDK_MAX_STRING) == 0) {
      return static_cast<int>(index);
    }
  }
  return -1;
}

int irsdk_varNameToOffset(const char* name) {
  const int index = irsdk_varNameToIndex(name);
  const auto* variable = irsdk_getVarHeaderEntry(index);
  return variable == nullptr ? -1 : variable->offset;
}

void irsdk_broadcastMsg(irsdk_BroadcastMsg, int, int, int) {}
void irsdk_broadcastMsg(irsdk_BroadcastMsg, int, int) {}
void irsdk_broadcastMsg(irsdk_BroadcastMsg, int, float) {}

int irsdk_padCarNum(int num, int zero) {
  int places = num > 99 ? 3 : (num > 9 ? 2 : 1);
  if (zero == 0) {
    return num;
  }
  places += zero;
  return num + 1000 * places;
}
