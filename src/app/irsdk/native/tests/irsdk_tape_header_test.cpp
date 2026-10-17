#include "../lib/irsdk_capture.h"
#include "../replay/irsdk_tape.h"

#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <limits>

namespace replay = irdashies::irsdk_replay;

#define CHECK(condition) do { if (!(condition)) { \
  std::cerr << __FILE__ << ':' << __LINE__ << ": " #condition "\n"; \
  std::exit(1); } } while (false)

void writeTape(const std::filesystem::path& path, int slot, int tick) {
  irsdk_header header{};
  header.ver = 2;
  header.tickRate = 60;
  header.numVars = 1;
  header.varHeaderOffset = sizeof(irsdk_header);
  header.numBuf = 3;
  header.bufLen = sizeof(tick);
  for (int i = 0; i < header.numBuf; ++i) {
    header.varBuf[i].bufOffset = 1024 + i * header.bufLen;
    header.varBuf[i].tickCount = 999; // Startup must reset unpublished slots.
  }
  irsdk_varHeader variable{};
  variable.type = irsdk_int;
  variable.count = 1;
  std::memcpy(variable.name, "SessionTick", sizeof("SessionTick"));
  std::string error;
  replay::TapeWriter writer;
  CHECK(writer.open(path, header, {variable}, 2048, 60, error));
  CHECK(writer.append(replay::RecordKind::Frame, 0, tick, slot,
                      &tick, sizeof(tick), error));
  CHECK(writer.append(replay::RecordKind::End, 60, tick, 0, nullptr, 0, error));
  CHECK(writer.finish(2048, error));
}

void checkPublishedHeader(const std::filesystem::path& path, int slot,
                          bool pollOnly) {
  constexpr int tick = 123;
  writeTape(path, slot, tick);
  CHECK(irsdk_startup());
  const auto* header = irsdk_getHeader();
  CHECK(header != nullptr);
  for (int i = 0; i < header->numBuf; ++i) {
    CHECK(header->varBuf[i].tickCount == -1);
  }

  irsdk_capture capture;
  CHECK(irsdk_waitForDataReady(0, pollOnly ? nullptr : &capture));
  header = irsdk_getHeader();
  CHECK(header != nullptr);
  if (!pollOnly) {
    CHECK(capture.valid);
    int capturedTick = 0;
    CHECK(capture.data.size() == sizeof(capturedTick));
    std::memcpy(&capturedTick, capture.data.data(), sizeof(capturedTick));
    CHECK(capturedTick == tick);
  }
  for (int i = 0; i < header->numBuf; ++i) {
    const int expected = i == slot ? tick : -1;
    CHECK(header->varBuf[i].tickCount == expected);
    if (!pollOnly) CHECK(capture.header.varBuf[i].tickCount == expected);
  }
  irsdk_shutdown();
}

int main(int argc, char** argv) {
  CHECK(argc == 2);
  const std::filesystem::path path(argv[1]);
#ifdef _WIN32
  CHECK(_putenv_s("IRDASHIES_TELEMETRY_REPLAY", argv[1]) == 0);
  CHECK(_putenv_s("IRDASHIES_TELEMETRY_REPLAY_SPEED", "1") == 0);
  CHECK(_putenv_s("IRDASHIES_TELEMETRY_REPLAY_LOOP", "0") == 0);
#else
  CHECK(setenv("IRDASHIES_TELEMETRY_REPLAY", argv[1], 1) == 0);
  CHECK(setenv("IRDASHIES_TELEMETRY_REPLAY_SPEED", "1", 1) == 0);
  CHECK(setenv("IRDASHIES_TELEMETRY_REPLAY_LOOP", "0", 1) == 0);
#endif
  for (int slot : {0, 2, -1, 3, std::numeric_limits<int>::max()}) {
    checkPublishedHeader(path, slot, false);
    checkPublishedHeader(path, slot, true);
  }
  std::filesystem::remove(path);
  std::cout << "Tape replay header tests passed\n";
}
