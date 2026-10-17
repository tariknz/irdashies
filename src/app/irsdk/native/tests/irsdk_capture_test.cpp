#include "../lib/irsdk_capture.h"

#include <cstdlib>
#include <functional>
#include <iostream>
#include <limits>
#include <string>

namespace sdk = irdashies::irsdk;

#define CHECK(condition) do { if (!(condition)) { \
  std::cerr << __FILE__ << ':' << __LINE__ << ": " #condition "\n"; \
  std::exit(1); } } while (false)

struct Mapping {
  std::vector<char> bytes = std::vector<char>(4096, 0);
  irsdk_header header{};
  irsdk_varHeader variable{};
  irsdk_capture captured;
  int lastTick = INT_MAX;
  int frameCopies = 0;
  int reads = 0;
  std::function<void(std::size_t, std::size_t)> beforeRead;
  std::function<void(std::size_t, std::size_t)> afterRead;

  Mapping() {
    header.ver = 2;
    header.status = irsdk_stConnected;
    header.tickRate = 60;
    header.numVars = 1;
    header.varHeaderOffset = sizeof(irsdk_header);
    header.numBuf = 2;
    header.bufLen = 16;
    header.varBuf[0].bufOffset = 1024;
    header.varBuf[0].tickCount = 10;
    header.varBuf[1].bufOffset = 2048;
    header.varBuf[1].tickCount = 9;
    variable.type = irsdk_int;
    variable.count = 1;
    std::strcpy(variable.name, "Test");
    publish();
  }

  void publish() {
    std::memcpy(bytes.data(), &header, sizeof(header));
    if (header.varHeaderOffset >= 0 &&
        sdk::byteRange(static_cast<std::size_t>(header.varHeaderOffset),
                       sizeof(variable), bytes.size())) {
      std::memcpy(bytes.data() + header.varHeaderOffset, &variable, sizeof(variable));
    }
  }

  bool capture(irsdk_capture* target) {
    return sdk::captureFrame([&](std::size_t offset, void* destination, std::size_t length) {
      ++reads;
      if (beforeRead) beforeRead(offset, length);
      CHECK(sdk::byteRange(offset, length, bytes.size()));
      if (destination == captured.data.data()) {
        ++frameCopies;
        CHECK(length <= captured.data.size());
        CHECK(length <= captured.data.capacity());
      }
      std::memcpy(destination, bytes.data() + offset, length);
      if (afterRead) afterRead(offset, length);
      return true;
    }, bytes.size(), lastTick, target);
  }
  bool capture() { return capture(&captured); }
};

void frameSizesAndReconnect() {
  Mapping m;
  std::fill(m.bytes.begin() + 1024, m.bytes.begin() + 1536, 'a');
  CHECK(m.capture());
  CHECK(m.lastTick == 10);
  CHECK(m.captured.data.size() == 16);
  CHECK(m.captured.data.back() == 'a');
  CHECK(!m.capture()); // Same tick must not be consumed twice.
  CHECK(m.captured.valid);
  m.header.bufLen = 512;
  m.header.varBuf[0].tickCount = 11;
  m.publish();
  CHECK(m.capture());
  CHECK(m.captured.data.size() == 512);
  CHECK(m.captured.data.back() == 'a');
  // Layout replacement at a paused/unchanged tick must still be captured.
  m.header.bufLen = 128;
  m.publish();
  CHECK(m.capture());
  CHECK(m.lastTick == 11);
  CHECK(m.captured.data.size() == 128);
  m.variable.offset = 12; // valid before shrinking, out of range afterward
  m.header.bufLen = 4;
  m.header.varBuf[0].tickCount = 12;
  m.publish();
  CHECK(m.capture());
  CHECK(m.captured.data.size() == 4);
  CHECK(m.captured.data.capacity() >= 512);
  CHECK(sdk::capturedVariable(m.captured, 0) == nullptr);

  m.header.status = 0;
  m.publish();
  CHECK(!m.capture());
  CHECK(!m.captured.valid);
  CHECK(m.lastTick == INT_MAX);
  m.header.status = irsdk_stConnected;
  m.header.bufLen = 256;
  m.variable.offset = 0;
  m.header.varBuf[0].tickCount = 1;
  m.header.varBuf[1].tickCount = 0;
  m.publish();
  CHECK(m.capture()); // Paused reconnect is seeded at its current tick.
  CHECK(m.captured.data.size() == 256);
  CHECK(m.lastTick == 1);
  m.header.varBuf[0].tickCount = 0;
  m.publish();
  CHECK(!m.capture()); // Backward ticks resynchronize, then resume.
  CHECK(!m.captured.valid);
  m.header.varBuf[0].tickCount = 1;
  m.publish();
  CHECK(m.capture());
}

void invalidLayouts() {
  const auto rejected = [](const std::function<void(Mapping&)>& mutate) {
    Mapping m;
    CHECK(m.capture());
    const int copies = m.frameCopies;
    ++m.header.varBuf[0].tickCount;
    mutate(m);
    m.publish();
    CHECK(!m.capture());
    CHECK(!m.captured.valid);
    CHECK(m.frameCopies == copies); // Rejected before the frame memcpy.
    CHECK(m.lastTick == INT_MAX);
  };
  for (int length : {-1, 0, 4096, INT_MAX, static_cast<int>(sdk::maxFrameBytes) + 1})
    rejected([=](Mapping& m) { m.header.bufLen = length; });
  for (int count : {-1, 0, IRSDK_MAX_BUFS + 1, INT_MAX})
    rejected([=](Mapping& m) { m.header.numBuf = count; });
  for (int count : {-1, 0, sdk::maxVariables + 1, INT_MAX})
    rejected([=](Mapping& m) { m.header.numVars = count; });
  for (int offset : {-1, 0, INT_MAX, 4090}) {
    rejected([=](Mapping& m) { m.header.varBuf[0].bufOffset = offset; });
    rejected([=](Mapping& m) { m.header.varHeaderOffset = offset; });
  }
  rejected([](Mapping& m) { m.header.varBuf[1].bufOffset = -1; });
  rejected([](Mapping& m) { m.header.varBuf[1].bufOffset = 1028; });
  rejected([](Mapping& m) { m.header.varBuf[0].bufOffset = sizeof(irsdk_header); });
  rejected([](Mapping& m) { m.header.ver = 0; });
  rejected([](Mapping& m) { m.header.tickRate = -1; });

  Mapping m;
  m.bytes.resize(sizeof(irsdk_header) - 1);
  CHECK(!m.capture());
  CHECK(m.reads == 0);
}

void invalidVariables() {
  const auto maximum = std::numeric_limits<std::size_t>::max();
  CHECK(!sdk::byteRange(maximum, 1, maximum));
  CHECK(!sdk::byteRange(1, maximum, maximum));
  CHECK(sdk::byteRange(maximum, 0, maximum));
  Mapping m;
  CHECK(m.capture());
  auto& var = m.captured.variables[0];
  std::size_t bytes = 99;
  for (int type : {-1, static_cast<int>(irsdk_ETCount), INT_MAX}) {
    var.type = type;
    CHECK(!sdk::variableRange(var, 16, bytes));
    CHECK(bytes == 0);
  }
  var.type = irsdk_double;
  for (int count : {-1, 0, INT_MAX, 3}) {
    var.count = count;
    CHECK(!sdk::variableRange(var, 16, bytes));
  }
  var.count = 1;
  for (int offset : {-1, INT_MAX, 9, 16}) {
    var.offset = offset;
    CHECK(!sdk::variableRange(var, 16, bytes));
  }
  var.offset = 8;
  CHECK(sdk::variableRange(var, 16, bytes));
  CHECK(bytes == 8); // Exact end is valid.
  var.offset = 1;
  CHECK(sdk::variableRange(var, 16, bytes)); // Unaligned is safe with memcpy.
  unsigned char invalidBool = 2;
  std::memcpy(&var.countAsTime, &invalidBool, 1);
  CHECK(!sdk::variableRange(var, 16, bytes));
  CHECK(sdk::capturedVariable(m.captured, -1) == nullptr);
  CHECK(sdk::capturedVariable(m.captured, INT_MAX) == nullptr);
  m.captured.valid = false;
  CHECK(sdk::capturedVariable(m.captured, 0) == nullptr);
}

void mutableHeaderAndRetries() {
  // Change lengths, offsets and metadata after the header snapshot, before the
  // copy. Only frozen validated sizes are used; the retry captures the new layout.
  for (int newLength : {4, 512}) {
    Mapping m;
    bool changed = false;
    m.afterRead = [&](std::size_t offset, std::size_t) {
      if (offset == 0 && !changed) {
        changed = true;
        m.header.bufLen = newLength;
        m.header.varBuf[0].bufOffset = 1536;
        m.header.varHeaderOffset = 512;
        m.variable.type = irsdk_char;
        m.variable.count = newLength;
        std::fill(m.bytes.begin() + 1536, m.bytes.begin() + 1536 + newLength, 'b');
        m.publish();
      }
    };
    CHECK(m.capture());
    CHECK(m.frameCopies == 2);
    CHECK(m.captured.header.bufLen == newLength);
    CHECK(m.captured.data.size() == static_cast<std::size_t>(newLength));
    CHECK(m.captured.data.front() == 'b');
    CHECK(m.captured.data.back() == 'b');
    CHECK(m.captured.variables[0].count == newLength);
  }

  Mapping m;
  // First copy torn, second coherent: retry must not be suppressed as duplicate.
  bool changed = false;
  m.afterRead = [&](std::size_t offset, std::size_t) {
    if (offset == 1024 && !changed) {
      changed = true;
      ++m.header.varBuf[0].tickCount;
      std::fill(m.bytes.begin() + 1024, m.bytes.begin() + 1040, 'c');
      m.publish();
    }
  };
  CHECK(m.capture());
  CHECK(m.frameCopies == 2);
  CHECK(m.lastTick == 11);
  CHECK(m.captured.data.back() == 'c');

  Mapping ring;
  changed = false;
  ring.afterRead = [&](std::size_t offset, std::size_t) {
    if (offset == 1024 && !changed) {
      changed = true;
      ring.header.varBuf[0].tickCount = 11;
      ring.header.varBuf[1].tickCount = 12;
      std::fill(ring.bytes.begin() + 2048, ring.bytes.begin() + 2064, 'd');
      ring.publish();
    }
  };
  CHECK(ring.capture());
  CHECK(ring.frameCopies == 2);
  CHECK(ring.lastTick == 12);
  CHECK(ring.captured.data.back() == 'd'); // Reselect latest buffer on retry.

  Mapping table;
  changed = false;
  table.afterRead = [&](std::size_t offset, std::size_t) {
    if (offset == 1024 && !changed) {
      changed = true;
      table.header.numVars = 2;
      table.publish();
      auto second = table.variable;
      second.offset = 8;
      std::memcpy(table.bytes.data() + table.header.varHeaderOffset + sizeof(second),
                  &second, sizeof(second));
    }
  };
  CHECK(table.capture());
  CHECK(table.frameCopies == 2);
  CHECK(table.captured.variables.size() == 2);
  CHECK(sdk::capturedVariable(table.captured, 1) != nullptr);

  // Metadata may change even when numVars, offsets and the frame tick do not.
  Mapping schema;
  changed = false;
  schema.afterRead = [&](std::size_t offset, std::size_t) {
    if (offset == 1024 && !changed) {
      changed = true;
      schema.variable.offset = 4;
      schema.publish();
    }
  };
  CHECK(schema.capture());
  CHECK(schema.frameCopies == 2);
  CHECK(schema.captured.variables[0].offset == 4);

  Mapping torn;
  torn.afterRead = [&](std::size_t offset, std::size_t) {
    if (offset == 1024) { ++torn.header.varBuf[0].tickCount; torn.publish(); }
  };
  CHECK(!torn.capture());
  CHECK(torn.frameCopies == 2);
  CHECK(!torn.captured.valid);
  CHECK(torn.lastTick == INT_MAX);
  torn.afterRead = {};
  CHECK(torn.capture());
  CHECK(torn.lastTick == 12);

  // Disconnect or invalid metadata arriving during a copy is never published.
  for (int invalidation = 0; invalidation < 4; ++invalidation) {
    Mapping bad;
    bad.afterRead = [&](std::size_t offset, std::size_t) {
      if (offset == 1024) {
        if (invalidation == 0) bad.header.status = 0;
        if (invalidation == 1) bad.header.bufLen = INT_MAX;
        if (invalidation == 2) bad.header.numBuf = INT_MAX;
        if (invalidation == 3) bad.header.varBuf[0].bufOffset = INT_MAX;
        bad.publish();
      }
    };
    CHECK(!bad.capture());
    CHECK(!bad.captured.valid);
    CHECK(bad.frameCopies == 1);
  }
}

void pollingAndReadFailures() {
  Mapping m;
  CHECK(m.capture(nullptr));
  CHECK(m.frameCopies == 0);
  CHECK(m.lastTick == 10);
  CHECK(!m.capture(nullptr));
  ++m.header.varBuf[0].tickCount;
  m.publish();
  CHECK(m.capture());
  CHECK(m.lastTick == 11);
  CHECK(m.captured.valid);

  for (int failRead = 1; failRead <= 5; ++failRead) {
    int tick = INT_MAX;
    int reads = 0;
    irsdk_capture failed;
    const auto read = [&](std::size_t offset, void* destination, std::size_t size) {
      if (++reads == failRead) return false;
      std::memcpy(destination, m.bytes.data() + offset, size);
      return true;
    };
    CHECK(!sdk::captureFrame(read, m.bytes.size(), tick, &failed));
    CHECK(!failed.valid);
    CHECK(tick == INT_MAX);
  }
}

int main() {
  frameSizesAndReconnect();
  invalidLayouts();
  invalidVariables();
  mutableHeaderAndRetries();
  pollingAndReadFailures();
  std::cout << "Native capture safety tests passed\n";
}
