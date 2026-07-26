#ifndef IRDASHIES_IRSDK_TAPE_H
#define IRDASHIES_IRSDK_TAPE_H

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "../lib/irsdk_defines.h"

namespace irdashies::irsdk_replay {

constexpr std::uint32_t kTapeFormatVersion = 1;
constexpr std::uint32_t kEndianMarker = 0x01020304;
constexpr std::uint64_t kMaxMappingSize = 512ULL * 1024ULL * 1024ULL;
constexpr std::uint32_t kMaxPayloadSize = 64U * 1024U * 1024U;

enum class RecordKind : std::uint32_t {
  Frame = 1,
  SessionInfo = 2,
  Gap = 3,
  Disconnect = 4,
  End = 5,
};

#pragma pack(push, 1)
struct TapeFileHeader {
  char magic[8];
  std::uint32_t formatVersion;
  std::uint32_t endianMarker;
  std::uint32_t fileHeaderSize;
  std::uint32_t sdkHeaderSize;
  std::uint32_t varHeaderSize;
  std::uint32_t varCount;
  std::uint64_t mappingSize;
  std::uint64_t qpcFrequency;
  std::uint64_t recordCount;
  std::uint32_t schemaChecksum;
  std::uint32_t reserved[9];
};

struct TapeRecordHeader {
  std::uint32_t kind;
  std::uint32_t recordHeaderSize;
  std::uint32_t payloadSize;
  std::uint32_t flags;
  std::uint64_t elapsedTicks;
  std::int32_t sourceTick;
  std::int32_t value;
  std::uint32_t payloadChecksum;
  std::uint32_t reserved;
};
#pragma pack(pop)

static_assert(sizeof(TapeFileHeader) == 96, "TapeFileHeader layout changed");
static_assert(sizeof(TapeRecordHeader) == 40, "TapeRecordHeader layout changed");

std::uint32_t checksum(const void* data, std::size_t size);

bool validateSdkLayout(
    const irsdk_header& header,
    const std::vector<irsdk_varHeader>& variables,
    std::uint64_t& requiredSize,
    std::string& error);

class TapeWriter {
 public:
  bool open(
      const std::filesystem::path& path,
      const irsdk_header& sdkHeader,
      const std::vector<irsdk_varHeader>& variables,
      std::uint64_t mappingSize,
      std::uint64_t qpcFrequency,
      std::string& error);

  bool append(
      RecordKind kind,
      std::uint64_t elapsedTicks,
      std::int32_t sourceTick,
      std::int32_t value,
      const void* payload,
      std::uint32_t payloadSize,
      std::string& error);

  bool finish(std::uint64_t mappingSize, std::string& error);

  std::uint64_t recordCount() const {
    return header_.recordCount;
  }

 private:
  std::fstream stream_;
  TapeFileHeader header_{};
  bool finished_ = false;
};

enum class TapeReadResult {
  Record,
  EndOfFile,
  Error,
};

class TapeReader {
 public:
  bool open(const std::filesystem::path& path, std::string& error);

  TapeReadResult readNext(
      TapeRecordHeader& record,
      std::vector<char>& payload,
      std::string& error);

  bool rewindRecords(std::string& error);

  const TapeFileHeader& fileHeader() const {
    return fileHeader_;
  }

  const irsdk_header& sdkHeader() const {
    return sdkHeader_;
  }

  const std::vector<irsdk_varHeader>& variables() const {
    return variables_;
  }

 private:
  std::ifstream stream_;
  TapeFileHeader fileHeader_{};
  irsdk_header sdkHeader_{};
  std::vector<irsdk_varHeader> variables_;
  std::streampos recordsOffset_{};
};

}  // namespace irdashies::irsdk_replay

#endif
