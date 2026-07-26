#include "./irsdk_tape.h"

#include <algorithm>
#include <array>
#include <cstring>
#include <limits>
#include <system_error>

namespace irdashies::irsdk_replay {
namespace {

constexpr std::array<char, 8> kMagic = {
    'I', 'R', 'D', 'T', 'R', 'C', 'E', '\0'};

bool checkedEnd(
    std::uint64_t offset,
    std::uint64_t length,
    std::uint64_t& end) {
  if (offset > std::numeric_limits<std::uint64_t>::max() - length) {
    return false;
  }
  end = offset + length;
  return true;
}

bool writeExact(
    std::ostream& stream,
    const void* data,
    std::size_t size,
    std::string& error) {
  stream.write(static_cast<const char*>(data), static_cast<std::streamsize>(size));
  if (!stream) {
    error = "Failed to write telemetry tape";
    return false;
  }
  return true;
}

bool readExact(
    std::istream& stream,
    void* data,
    std::size_t size,
    std::string& error) {
  stream.read(static_cast<char*>(data), static_cast<std::streamsize>(size));
  if (!stream) {
    error = "Telemetry tape is truncated";
    return false;
  }
  return true;
}

}  // namespace

std::uint32_t checksum(const void* data, std::size_t size) {
  constexpr std::uint32_t kFnvOffset = 2166136261U;
  constexpr std::uint32_t kFnvPrime = 16777619U;

  auto value = kFnvOffset;
  const auto* bytes = static_cast<const unsigned char*>(data);
  for (std::size_t i = 0; i < size; ++i) {
    value ^= bytes[i];
    value *= kFnvPrime;
  }
  return value;
}

bool validateSdkLayout(
    const irsdk_header& header,
    const std::vector<irsdk_varHeader>& variables,
    std::uint64_t& requiredSize,
    std::string& error) {
  if (header.ver <= 0) {
    error = "Invalid iRacing SDK header version";
    return false;
  }
  if (header.tickRate <= 0 || header.tickRate > 10000) {
    error = "Invalid telemetry tick rate";
    return false;
  }
  if (header.numVars <= 0 || header.numVars > 4096 ||
      variables.size() != static_cast<std::size_t>(header.numVars)) {
    error = "Invalid telemetry variable count";
    return false;
  }
  if (header.numBuf <= 0 || header.numBuf > IRSDK_MAX_BUFS) {
    error = "Invalid telemetry buffer count";
    return false;
  }
  if (header.bufLen <= 0 ||
      static_cast<std::uint32_t>(header.bufLen) > kMaxPayloadSize) {
    error = "Invalid telemetry buffer length";
    return false;
  }
  if (header.varHeaderOffset < static_cast<int>(sizeof(irsdk_header)) ||
      header.sessionInfoOffset < 0 || header.sessionInfoLen < 0) {
    error = "Invalid shared-memory offsets";
    return false;
  }

  requiredSize = sizeof(irsdk_header);
  std::vector<std::pair<std::uint64_t, std::uint64_t>> ranges = {
      {0, sizeof(irsdk_header)}};
  auto includeRange = [&](std::uint64_t offset, std::uint64_t length) {
    std::uint64_t end = 0;
    if (!checkedEnd(offset, length, end) || end > kMaxMappingSize) {
      return false;
    }
    requiredSize = std::max(requiredSize, end);
    ranges.emplace_back(offset, end);
    return true;
  };

  if (!includeRange(
          static_cast<std::uint64_t>(header.varHeaderOffset),
          variables.size() * sizeof(irsdk_varHeader)) ||
      !includeRange(
          static_cast<std::uint64_t>(header.sessionInfoOffset),
          static_cast<std::uint64_t>(header.sessionInfoLen))) {
    error = "Shared-memory metadata exceeds the safety limit";
    return false;
  }

  for (int i = 0; i < header.numBuf; ++i) {
    if (header.varBuf[i].bufOffset < 0 ||
        !includeRange(
            static_cast<std::uint64_t>(header.varBuf[i].bufOffset),
            static_cast<std::uint64_t>(header.bufLen))) {
      error = "Telemetry buffer exceeds the safety limit";
      return false;
    }
  }

  for (std::size_t left = 0; left < ranges.size(); ++left) {
    for (std::size_t right = left + 1; right < ranges.size(); ++right) {
      if (ranges[left].first < ranges[right].second &&
          ranges[right].first < ranges[left].second) {
        error = "Shared-memory regions overlap";
        return false;
      }
    }
  }

  for (const auto& variable : variables) {
    if (variable.type < 0 || variable.type >= irsdk_ETCount ||
        variable.offset < 0 || variable.count <= 0) {
      error = "Invalid telemetry variable descriptor";
      return false;
    }
    const auto byteCount =
        static_cast<std::uint64_t>(irsdk_VarTypeBytes[variable.type]) *
        static_cast<std::uint64_t>(variable.count);
    std::uint64_t variableEnd = 0;
    if (!checkedEnd(
            static_cast<std::uint64_t>(variable.offset),
            byteCount,
            variableEnd) ||
        variableEnd > static_cast<std::uint64_t>(header.bufLen)) {
      error = "Telemetry variable extends past its frame buffer";
      return false;
    }
  }

  return true;
}

bool TapeWriter::open(
    const std::filesystem::path& path,
    const irsdk_header& sdkHeader,
    const std::vector<irsdk_varHeader>& variables,
    std::uint64_t mappingSize,
    std::uint64_t qpcFrequency,
    std::string& error) {
  if (stream_.is_open()) {
    error = "Telemetry tape writer is already open";
    return false;
  }

  std::uint64_t requiredSize = 0;
  if (!validateSdkLayout(sdkHeader, variables, requiredSize, error)) {
    return false;
  }
  if (mappingSize < requiredSize || mappingSize > kMaxMappingSize ||
      qpcFrequency == 0) {
    error = "Invalid telemetry tape metadata";
    return false;
  }

  std::error_code directoryError;
  const auto parent = path.parent_path();
  if (!parent.empty()) {
    std::filesystem::create_directories(parent, directoryError);
    if (directoryError) {
      error = "Could not create the telemetry capture directory";
      return false;
    }
  }

  stream_.open(
      path,
      std::ios::binary | std::ios::in | std::ios::out | std::ios::trunc);
  if (!stream_) {
    error = "Could not create the telemetry tape";
    return false;
  }

  std::memcpy(header_.magic, kMagic.data(), kMagic.size());
  header_.formatVersion = kTapeFormatVersion;
  header_.endianMarker = kEndianMarker;
  header_.fileHeaderSize = sizeof(TapeFileHeader);
  header_.sdkHeaderSize = sizeof(irsdk_header);
  header_.varHeaderSize = sizeof(irsdk_varHeader);
  header_.varCount = static_cast<std::uint32_t>(variables.size());
  header_.mappingSize = mappingSize;
  header_.qpcFrequency = qpcFrequency;
  header_.recordCount = 0;
  header_.schemaChecksum =
      checksum(variables.data(), variables.size() * sizeof(irsdk_varHeader));

  return writeExact(stream_, &header_, sizeof(header_), error) &&
      writeExact(stream_, &sdkHeader, sizeof(sdkHeader), error) &&
      writeExact(
          stream_,
          variables.data(),
          variables.size() * sizeof(irsdk_varHeader),
          error);
}

bool TapeWriter::append(
    RecordKind kind,
    std::uint64_t elapsedTicks,
    std::int32_t sourceTick,
    std::int32_t value,
    const void* payload,
    std::uint32_t payloadSize,
    std::string& error) {
  if (!stream_.is_open() || finished_) {
    error = "Telemetry tape writer is not open";
    return false;
  }
  if (payloadSize > kMaxPayloadSize ||
      (payloadSize > 0 && payload == nullptr)) {
    error = "Invalid telemetry record payload";
    return false;
  }

  TapeRecordHeader record{};
  record.kind = static_cast<std::uint32_t>(kind);
  record.recordHeaderSize = sizeof(TapeRecordHeader);
  record.payloadSize = payloadSize;
  record.elapsedTicks = elapsedTicks;
  record.sourceTick = sourceTick;
  record.value = value;
  record.payloadChecksum =
      payloadSize == 0 ? checksum(nullptr, 0) : checksum(payload, payloadSize);

  if (!writeExact(stream_, &record, sizeof(record), error) ||
      (payloadSize > 0 &&
       !writeExact(stream_, payload, payloadSize, error))) {
    return false;
  }

  ++header_.recordCount;
  return true;
}

bool TapeWriter::finish(std::uint64_t mappingSize, std::string& error) {
  if (!stream_.is_open()) {
    error = "Telemetry tape writer is not open";
    return false;
  }
  if (finished_) {
    return true;
  }
  if (mappingSize == 0 || mappingSize > kMaxMappingSize) {
    error = "Invalid final shared-memory size";
    return false;
  }

  header_.mappingSize = std::max(header_.mappingSize, mappingSize);
  stream_.seekp(0);
  if (!writeExact(stream_, &header_, sizeof(header_), error)) {
    return false;
  }
  stream_.flush();
  if (!stream_) {
    error = "Failed to finalize telemetry tape";
    return false;
  }
  finished_ = true;
  return true;
}

bool TapeReader::open(
    const std::filesystem::path& path,
    std::string& error) {
  stream_.open(path, std::ios::binary);
  if (!stream_) {
    error = "Could not open the telemetry tape";
    return false;
  }

  if (!readExact(stream_, &fileHeader_, sizeof(fileHeader_), error)) {
    return false;
  }
  if (std::memcmp(
          fileHeader_.magic,
          kMagic.data(),
          kMagic.size()) != 0) {
    error = "File is not an irDashies telemetry tape";
    return false;
  }
  if (fileHeader_.formatVersion != kTapeFormatVersion ||
      fileHeader_.endianMarker != kEndianMarker ||
      fileHeader_.fileHeaderSize != sizeof(TapeFileHeader) ||
      fileHeader_.sdkHeaderSize != sizeof(irsdk_header) ||
      fileHeader_.varHeaderSize != sizeof(irsdk_varHeader) ||
      fileHeader_.varCount == 0 || fileHeader_.varCount > 4096 ||
      fileHeader_.mappingSize == 0 ||
      fileHeader_.mappingSize > kMaxMappingSize ||
      fileHeader_.qpcFrequency == 0) {
    error = "Unsupported or invalid telemetry tape header";
    return false;
  }

  variables_.resize(fileHeader_.varCount);
  if (!readExact(stream_, &sdkHeader_, sizeof(sdkHeader_), error) ||
      !readExact(
          stream_,
          variables_.data(),
          variables_.size() * sizeof(irsdk_varHeader),
          error)) {
    return false;
  }
  if (checksum(
          variables_.data(),
          variables_.size() * sizeof(irsdk_varHeader)) !=
      fileHeader_.schemaChecksum) {
    error = "Telemetry tape schema checksum mismatch";
    return false;
  }

  std::uint64_t requiredSize = 0;
  if (!validateSdkLayout(sdkHeader_, variables_, requiredSize, error)) {
    return false;
  }
  if (requiredSize > fileHeader_.mappingSize) {
    error = "Telemetry tape mapping is smaller than its SDK layout";
    return false;
  }

  recordsOffset_ = stream_.tellg();
  return true;
}

TapeReadResult TapeReader::readNext(
    TapeRecordHeader& record,
    std::vector<char>& payload,
    std::string& error) {
  stream_.read(
      reinterpret_cast<char*>(&record),
      static_cast<std::streamsize>(sizeof(record)));
  if (stream_.eof() && stream_.gcount() == 0) {
    return TapeReadResult::EndOfFile;
  }
  if (!stream_) {
    error = "Telemetry tape record header is truncated";
    return TapeReadResult::Error;
  }
  if (record.recordHeaderSize != sizeof(TapeRecordHeader) ||
      record.payloadSize > kMaxPayloadSize ||
      record.kind < static_cast<std::uint32_t>(RecordKind::Frame) ||
      record.kind > static_cast<std::uint32_t>(RecordKind::End)) {
    error = "Invalid telemetry tape record";
    return TapeReadResult::Error;
  }

  payload.resize(record.payloadSize);
  if (record.payloadSize > 0 &&
      !readExact(stream_, payload.data(), payload.size(), error)) {
    return TapeReadResult::Error;
  }
  const auto actualChecksum = record.payloadSize == 0
      ? checksum(nullptr, 0)
      : checksum(payload.data(), payload.size());
  if (actualChecksum != record.payloadChecksum) {
    error = "Telemetry tape record checksum mismatch";
    return TapeReadResult::Error;
  }

  return TapeReadResult::Record;
}

bool TapeReader::rewindRecords(std::string& error) {
  stream_.clear();
  stream_.seekg(recordsOffset_);
  if (!stream_) {
    error = "Could not rewind telemetry tape";
    return false;
  }
  return true;
}

}  // namespace irdashies::irsdk_replay
