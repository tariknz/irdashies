#include "./irsdk_tape.h"
#include "../lib/irsdk_capture.h"

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
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

namespace replay = irdashies::irsdk_replay;

namespace {

enum class PlaybackState {
  Stopped,
  Playing,
  NeedsDisconnectSignal,
  ReadyToLoop,
  Finished,
  Failed,
  SeekDisconnect,
  SeekPending,
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
bool maximumSpeed = false;
bool frameByFrame = false;
bool initialPause = false;
bool primeInitialFrame = false;
std::uint64_t framesConsumed = 0;
std::uint64_t framesDelivered = 0;
bool paused = false;
bool seekFrameReady = false;
bool stepPending = false;
double rangeStart = -1;
double rangeEnd = -1;
double anchorSeconds = 0;
double durationSeconds = 0;
std::string lastError;

struct SeekPoint {
  double seconds;
  std::streampos frameOffset;
  std::streampos sessionOffset;
};
// One checkpoint per recorded second; frame payloads stay on disk.
std::vector<SeekPoint> seekPoints;

double playbackPosition() {
  if (maximumSpeed || paused || state != PlaybackState::Playing) return anchorSeconds;
  return std::min(durationSeconds, anchorSeconds +
      std::chrono::duration<double>(std::chrono::steady_clock::now() -
          playbackStart).count() * playbackSpeed);
}

void rebaseClock(double seconds) {
  anchorSeconds = seconds;
  playbackStart = std::chrono::steady_clock::now();
}

bool indexTape(std::string& error) {
  seekPoints.clear();
  durationSeconds = 0;
  std::streampos sessionOffset = -1;
  replay::TapeRecordHeader record{};
  std::vector<char> payload;
  std::uint64_t previousTicks = 0;
  for (;;) {
    const auto offset = tape->recordPosition();
    const auto result = tape->readNext(record, payload, error);
    if (result == replay::TapeReadResult::EndOfFile) break;
    if (result == replay::TapeReadResult::Error) return false;
    if (record.elapsedTicks < previousTicks) {
      error = "Telemetry tape timestamps run backwards";
      return false;
    }
    previousTicks = record.elapsedTicks;
    const double seconds = static_cast<double>(record.elapsedTicks) /
        static_cast<double>(tape->fileHeader().qpcFrequency);
    durationSeconds = seconds;
    const auto kind = static_cast<replay::RecordKind>(record.kind);
    if (kind == replay::RecordKind::SessionInfo) sessionOffset = offset;
    if (kind == replay::RecordKind::Frame &&
        (seekPoints.empty() || seconds - seekPoints.back().seconds >= 1.0)) {
      seekPoints.push_back({seconds, offset, sessionOffset});
    }
    if (kind == replay::RecordKind::End ||
        kind == replay::RecordKind::Disconnect) break;
  }
  if (seekPoints.empty()) {
    error = "Telemetry tape has no frames";
    return false;
  }
  return tape->rewindRecords(error);
}

// Node updates the Windows process environment through Win32, not this DLL's
// private CRT environment cache. Read the current OS block on every startup.
#ifdef _WIN32
std::wstring environmentValue(const wchar_t* name) {
  DWORD capacity = GetEnvironmentVariableW(name, nullptr, 0);
  while (capacity > 0) {
    std::wstring value(capacity, L'\0');
    const DWORD length = GetEnvironmentVariableW(name, value.data(), capacity);
    if (length == 0) return {};
    if (length < capacity) { value.resize(length); return value; }
    capacity = length;
  }
  return {};
}
std::string playbackOption(const char* name) {
  const std::wstring wideName(name, name + std::strlen(name));
  const auto value = environmentValue(wideName.c_str());
  return std::string(value.begin(), value.end()); // Options are ASCII numbers/flags.
}
std::filesystem::path playbackInput() {
  return std::filesystem::path(environmentValue(L"IRDASHIES_TELEMETRY_REPLAY"));
}
#else
std::string playbackOption(const char* name) {
  const char* value = std::getenv(name);
  return value ? value : "";
}
std::filesystem::path playbackInput() {
  return std::filesystem::path(playbackOption("IRDASHIES_TELEMETRY_REPLAY"));
}
#endif

bool parsePlaybackOptions(std::string& error) {
  const auto speedText = playbackOption("IRDASHIES_TELEMETRY_REPLAY_SPEED");
  maximumSpeed = speedText == "max";
  frameByFrame = maximumSpeed || playbackOption("IRDASHIES_TELEMETRY_REPLAY_EVERY_FRAME") == "1";
  initialPause = playbackOption("IRDASHIES_TELEMETRY_REPLAY_PAUSED") == "1";
  if (!maximumSpeed && !speedText.empty()) {
    char* end = nullptr;
    const double parsed = std::strtod(speedText.c_str(), &end);
    if (end == speedText.c_str() || end == nullptr || *end != '\0' ||
        !std::isfinite(parsed) || parsed < 0.25 || parsed > 100.0) {
      error = "IRDASHIES_TELEMETRY_REPLAY_SPEED must be between 0.25 and 100";
      return false;
    }
    playbackSpeed = parsed;
  } else playbackSpeed = 1.0;
  loopPlayback = playbackOption("IRDASHIES_TELEMETRY_REPLAY_LOOP") == "1";
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
  anchorSeconds = 0;
  seekFrameReady = false;
  state = PlaybackState::Playing;
}

bool openTape(std::string& error) {
  lastError.clear();
  const auto input = playbackInput();
  if (input.empty()) {
    error = "IRDASHIES_TELEMETRY_REPLAY is not set";
    return false;
  }
  if (!parsePlaybackOptions(error)) {
    return false;
  }

  auto candidate = std::make_unique<replay::TapeReader>();
  if (!candidate->open(input, error)) {
    return false;
  }
  tape = std::move(candidate);
  if (!indexTape(error)) return false;
  resetPublishedData();
  rangeStart = rangeEnd = -1;
  stepPending = false;
  paused = initialPause;
  primeInitialFrame = initialPause;
  framesConsumed = framesDelivered = 0;
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
  rebaseClock(durationSeconds);
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
  lastError = error;
  state = PlaybackState::Failed;
  header.status = 0;
  return false;
}

std::chrono::steady_clock::time_point pendingTargetTime() {
  if (maximumSpeed || primeInitialFrame) return std::chrono::steady_clock::now();
  const double seconds =
      static_cast<double>(pendingRecord.elapsedTicks) /
      static_cast<double>(tape->fileHeader().qpcFrequency);
  return playbackStart +
      std::chrono::duration_cast<std::chrono::steady_clock::duration>(
          std::chrono::duration<double>((seconds - anchorSeconds) / playbackSpeed));
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

bool publishFrameRecord(irsdk_capture* capture, std::string& error) {
  if (capture) capture->valid = false;
  if (pendingPayload.size() != frame.size()) {
    error = "Frame record length does not match the SDK buffer length";
    lastError = error;
    state = PlaybackState::Failed;
    header.status = 0;
    return false;
  }
  std::memcpy(frame.data(), pendingPayload.data(), frame.size());
  if (pendingRecord.value >= 0 && pendingRecord.value < header.numBuf) {
    header.varBuf[pendingRecord.value].tickCount = pendingRecord.sourceTick;
  }
  if (capture != nullptr) {
    // TapeReader validates the fixed schema and frame size when opening.
    capture->data.resize(frame.size());
    capture->variables.resize(tape->variables().size());
    std::memcpy(capture->variables.data(), tape->variables().data(),
                capture->variables.size() * sizeof(irsdk_varHeader));
    capture->header = header;
    std::memcpy(capture->data.data(), frame.data(), capture->data.size());
    capture->valid = true;
  }
  return true;
}

bool seekToAnchor(std::string& error) {
  const double target = anchorSeconds;
  const auto next = std::upper_bound(seekPoints.begin(), seekPoints.end(), target,
      [](double seconds, const SeekPoint& point) { return seconds < point.seconds; });
  const auto& point = next == seekPoints.begin() ? seekPoints.front() : *(next - 1);
  resetPublishedData();
  if (point.sessionOffset != std::streampos(-1)) {
    if (!tape->seekRecord(point.sessionOffset, error) ||
        tape->readNext(pendingRecord, pendingPayload, error) !=
            replay::TapeReadResult::Record) return false;
    applySessionRecord();
  }
  if (!tape->seekRecord(point.frameOffset, error)) return false;
  bool foundFrame = false;
  for (;;) {
    const auto result = tape->readNext(pendingRecord, pendingPayload, error);
    if (result == replay::TapeReadResult::Error) return false;
    if (result == replay::TapeReadResult::EndOfFile) break;
    const double seconds = static_cast<double>(pendingRecord.elapsedTicks) /
        static_cast<double>(tape->fileHeader().qpcFrequency);
    const auto kind = static_cast<replay::RecordKind>(pendingRecord.kind);
    // Keep the next timed record for normal playback, including End.
    if (foundFrame && (seconds > target || kind == replay::RecordKind::End ||
        kind == replay::RecordKind::Disconnect)) {
      hasPendingRecord = true;
      break;
    }
    if (kind == replay::RecordKind::SessionInfo) applySessionRecord();
    if (kind == replay::RecordKind::Frame) {
      if (!publishFrameRecord(nullptr, error)) return false;
      foundFrame = true;
    }
  }
  rebaseClock(target);
  seekFrameReady = foundFrame;
  return foundFrame;
}

bool readTimedFrame(int timeoutMs, irsdk_capture* capture) {
  if (seekFrameReady) {
    // Reuse the normal capture path without consuming the next timed record.
    if (capture) {
      capture->header = header;
      capture->data = frame;
      capture->variables = tape->variables();
      capture->valid = true;
    }
    seekFrameReady = false;
    return true;
  }
  if (paused && !primeInitialFrame && !stepPending) return false;
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
    if (target > now && !stepPending) {
      if (foundFrame || now >= deadline) {
        return foundFrame;
      }
      std::this_thread::sleep_for(std::min(target - now, deadline - now));
      continue;
    }

    const auto kind = static_cast<replay::RecordKind>(pendingRecord.kind);
    switch (kind) {
      case replay::RecordKind::Frame:
        if (rangeStart >= 0 && static_cast<double>(pendingRecord.elapsedTicks) /
            static_cast<double>(tape->fileHeader().qpcFrequency) >= rangeEnd) {
          stepPending = false;
          irsdk_tape_seek(rangeStart);
          return foundFrame;
        }
        if (!publishFrameRecord(capture, error)) {
          std::cerr << "Telemetry tape playback failed: " << error << '\n';
          return false;
        }
        foundFrame = true;
        framesConsumed++;
        if (stepPending) rebaseClock(static_cast<double>(pendingRecord.elapsedTicks) /
            static_cast<double>(tape->fileHeader().qpcFrequency));
        if (maximumSpeed) anchorSeconds =
            static_cast<double>(pendingRecord.elapsedTicks) /
            static_cast<double>(tape->fileHeader().qpcFrequency);
        if (frameByFrame || primeInitialFrame || stepPending) {
          stepPending = false;
          primeInitialFrame = false;
          hasPendingRecord = false;
          return true;
        }
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
        if (rangeStart >= 0) {
          stepPending = false;
          irsdk_tape_seek(rangeStart);
          return foundFrame;
        }
        finishPlayback(foundFrame);
        break;
    }
    hasPendingRecord = false;
  }

  return foundFrame;
}

}  // namespace

bool irsdk_startup() {
  if (state == PlaybackState::SeekDisconnect) {
    state = PlaybackState::SeekPending;
    return false;
  }
  if (state == PlaybackState::SeekPending) {
    std::string error;
    if (seekToAnchor(error)) return true;
    lastError = error;
    state = PlaybackState::Failed;
    header.status = 0;
    std::cerr << "Could not seek telemetry tape: " << error << '\n';
    return false;
  }
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
  lastError = error;
  state = PlaybackState::Failed;
  return false;
}

void irsdk_shutdown() {
  stepPending = false;
  rangeStart = rangeEnd = -1;
  tape.reset();
  frame.clear();
  session.clear();
  pendingPayload.clear();
  hasPendingRecord = false;
  header = {};
  state = PlaybackState::Stopped;
  seekPoints.clear();
  durationSeconds = 0;
  anchorSeconds = 0;
  seekFrameReady = false;
  lastError.clear();
}

bool irsdk_getNewData(irsdk_capture* capture) {
  const bool found = readTimedFrame(1, capture);
  if (found) framesDelivered++;
  return found;
}

bool irsdk_waitForDataReady(int timeoutMs, irsdk_capture* capture) {
  if (state != PlaybackState::Playing && !irsdk_startup()) {
    if (capture) capture->valid = false;
    return false;
  }
  const bool found = readTimedFrame(timeoutMs, capture);
  if (found) framesDelivered++;
  return found;
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

irsdk_tape_status irsdk_tape_getStatus() {
  return {playbackPosition(), durationSeconds, playbackSpeed, paused,
      state == PlaybackState::Finished, maximumSpeed, frameByFrame,
      state == PlaybackState::Failed, framesConsumed, framesDelivered, lastError, rangeStart, rangeEnd};
}

bool irsdk_tape_step() {
  if (!tape || !paused || stepPending || seekFrameReady || primeInitialFrame ||
      state != PlaybackState::Playing) return false;
  stepPending = true;
  return true;
}

bool irsdk_tape_setLoop(double start, double end) {
  if (!tape || !std::isfinite(start) || !std::isfinite(end)) return false;
  if (start == -1 && end == -1) {
    rangeStart = rangeEnd = -1;
    return true;
  }
  if (start < 0 || end > durationSeconds || end - start < 1.0 / std::max(1, header.tickRate)) return false;
  rangeStart = start;
  rangeEnd = end;
  const double position = playbackPosition();
  if (position < start || position >= end) return irsdk_tape_seek(start);
  return true;
}

bool irsdk_tape_seek(double seconds) {
  if (!tape || seekPoints.empty() || !std::isfinite(seconds)) return false;
  stepPending = false;
  rebaseClock(std::clamp(seconds, 0.0, durationSeconds));
  state = PlaybackState::SeekDisconnect;
  header.status = 0;
  return true;
}

bool irsdk_tape_setSpeed(double speed) {
  if (!tape || !std::isfinite(speed) || speed < 0.25 || speed > 100) return false;
  rebaseClock(playbackPosition());
  playbackSpeed = speed;
  maximumSpeed = false;
  return true;
}

bool irsdk_tape_setPaused(bool value) {
  if (!tape) return false;
  rebaseClock(playbackPosition());
  paused = value;
  if (!paused && state == PlaybackState::Finished) return irsdk_tape_seek(0);
  return true;
}
