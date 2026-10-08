#include "lmu_tape.h"

#include <algorithm>
#include <cstring>

namespace irdashies::lmu_replay {
namespace {

const char kMagic[8] = {'I', 'R', 'D', 'L', 'M', 'U', '1', '\0'};
constexpr std::size_t kSnapshotSize = sizeof(LMUObjectOut);
/** A guard against a corrupt length claiming an absurd allocation. */
constexpr std::uint32_t kMaxPayloadSize = 8U * 1024U * 1024U;

void writeVarint(std::vector<std::uint8_t>& out, std::uint64_t value) {
  while (value >= 0x80) {
    out.push_back(static_cast<std::uint8_t>(value) | 0x80);
    value >>= 7;
  }
  out.push_back(static_cast<std::uint8_t>(value));
}

bool readVarint(
    const std::uint8_t* data,
    std::size_t size,
    std::size_t& offset,
    std::uint64_t& value) {
  value = 0;
  int shift = 0;
  while (offset < size) {
    const std::uint8_t byte = data[offset++];
    if (shift > 63) return false;
    value |= static_cast<std::uint64_t>(byte & 0x7f) << shift;
    if ((byte & 0x80) == 0) return true;
    shift += 7;
  }
  return false;
}

}  // namespace

std::uint32_t checksum(const void* data, std::size_t size) {
  // FNV-1a. Not cryptographic -- this only has to catch a truncated or
  // corrupted record, which is what a wrong length or a half-written tape
  // looks like.
  const auto* bytes = static_cast<const std::uint8_t*>(data);
  std::uint32_t hash = 2166136261u;
  for (std::size_t i = 0; i < size; ++i) {
    hash ^= bytes[i];
    hash *= 16777619u;
  }
  return hash;
}

void xorInto(
    const std::uint8_t* prev,
    const std::uint8_t* cur,
    std::size_t size,
    std::uint8_t* out) {
  for (std::size_t i = 0; i < size; ++i) out[i] = prev[i] ^ cur[i];
}

void encodeRuns(
    const std::uint8_t* data,
    std::size_t size,
    std::vector<std::uint8_t>& out) {
  out.clear();
  std::size_t i = 0;
  while (i < size) {
    std::size_t zeros = 0;
    while (i + zeros < size && data[i + zeros] == 0) ++zeros;
    writeVarint(out, zeros);
    i += zeros;

    std::size_t literals = 0;
    while (i + literals < size && data[i + literals] != 0) ++literals;
    writeVarint(out, literals);
    if (literals > 0) {
      out.insert(out.end(), data + i, data + i + literals);
      i += literals;
    }
  }
}

bool decodeRuns(
    const std::uint8_t* data,
    std::size_t size,
    std::uint8_t* out,
    std::size_t outSize) {
  std::memset(out, 0, outSize);
  std::size_t offset = 0;
  std::size_t written = 0;
  while (offset < size) {
    std::uint64_t zeros = 0;
    if (!readVarint(data, size, offset, zeros)) return false;
    if (zeros > outSize - written) return false;
    written += static_cast<std::size_t>(zeros);

    std::uint64_t literals = 0;
    if (!readVarint(data, size, offset, literals)) return false;
    if (literals > outSize - written) return false;
    if (literals > size - offset) return false;
    std::memcpy(
        out + written, data + offset, static_cast<std::size_t>(literals));
    offset += static_cast<std::size_t>(literals);
    written += static_cast<std::size_t>(literals);
  }
  return written == outSize;
}

bool TapeWriter::open(const std::filesystem::path& path, std::string& error) {
  stream_.open(path, std::ios::binary | std::ios::out | std::ios::trunc);
  if (!stream_) {
    error = "Unable to open tape for writing: " + path.string();
    return false;
  }

  header_ = {};
  std::memcpy(header_.magic, kMagic, sizeof(kMagic));
  header_.formatVersion = kTapeFormatVersion;
  header_.endianMarker = kEndianMarker;
  header_.fileHeaderSize = sizeof(TapeFileHeader);
  header_.recordHeaderSize = sizeof(TapeRecordHeader);
  header_.snapshotSize = static_cast<std::uint32_t>(kSnapshotSize);
  header_.keyframeInterval = kKeyframeInterval;

  stream_.write(reinterpret_cast<const char*>(&header_), sizeof(header_));
  if (!stream_) {
    error = "Unable to write tape header";
    return false;
  }

  previous_.assign(kSnapshotSize, 0);
  hasPrevious_ = false;
  sinceKeyframe_ = 0;
  finished_ = false;
  return true;
}

bool TapeWriter::appendRecord(
    RecordKind kind,
    std::uint64_t elapsedMicros,
    const std::vector<std::uint8_t>& payload,
    std::string& error) {
  TapeRecordHeader record{};
  record.kind = static_cast<std::uint32_t>(kind);
  record.recordHeaderSize = sizeof(TapeRecordHeader);
  record.payloadSize = static_cast<std::uint32_t>(payload.size());
  record.elapsedMicros = elapsedMicros;
  record.payloadChecksum =
      payload.empty() ? 0 : checksum(payload.data(), payload.size());

  stream_.write(reinterpret_cast<const char*>(&record), sizeof(record));
  if (!payload.empty()) {
    stream_.write(
        reinterpret_cast<const char*>(payload.data()),
        static_cast<std::streamsize>(payload.size()));
  }
  if (!stream_) {
    error = "Unable to write tape record";
    return false;
  }
  ++header_.recordCount;
  header_.durationMicros = elapsedMicros;
  return true;
}

bool TapeWriter::appendSnapshot(
    const LMUObjectOut& snapshot,
    std::uint64_t elapsedMicros,
    std::string& error) {
  const auto* bytes = reinterpret_cast<const std::uint8_t*>(&snapshot);
  const bool keyframe = !hasPrevious_ || sinceKeyframe_ >= kKeyframeInterval;

  if (keyframe) {
    encodeRuns(bytes, kSnapshotSize, scratch_);
    sinceKeyframe_ = 0;
  } else {
    std::vector<std::uint8_t> delta(kSnapshotSize);
    xorInto(previous_.data(), bytes, kSnapshotSize, delta.data());
    encodeRuns(delta.data(), kSnapshotSize, scratch_);
    ++sinceKeyframe_;
  }

  if (!appendRecord(
          keyframe ? RecordKind::Keyframe : RecordKind::Delta,
          elapsedMicros,
          scratch_,
          error)) {
    return false;
  }

  std::memcpy(previous_.data(), bytes, kSnapshotSize);
  hasPrevious_ = true;
  return true;
}

bool TapeWriter::appendDisconnect(
    std::uint64_t elapsedMicros,
    std::string& error) {
  // The next snapshot has nothing to delta against: the sim restarting can
  // change everything at once, and a delta across that gap would be as large
  // as a keyframe anyway.
  hasPrevious_ = false;
  sinceKeyframe_ = 0;
  const std::vector<std::uint8_t> empty;
  return appendRecord(RecordKind::Disconnect, elapsedMicros, empty, error);
}

bool TapeWriter::appendRest(
    const std::string& path,
    const std::string& body,
    std::uint64_t elapsedMicros,
    std::string& error) {
  if (path.empty()) {
    error = "A REST record needs a path";
    return false;
  }

  TapeRestPayloadHeader restHeader{};
  restHeader.pathSize = static_cast<std::uint32_t>(path.size());
  restHeader.bodySize = static_cast<std::uint32_t>(body.size());

  // Verbatim, not run-length encoded: see RecordKind::Rest.
  std::vector<std::uint8_t> payload(
      sizeof(restHeader) + path.size() + body.size());
  std::memcpy(payload.data(), &restHeader, sizeof(restHeader));
  std::memcpy(payload.data() + sizeof(restHeader), path.data(), path.size());
  std::memcpy(
      payload.data() + sizeof(restHeader) + path.size(),
      body.data(),
      body.size());

  // Deliberately leaves hasPrevious_ and sinceKeyframe_ alone: a REST record
  // sits between snapshots and must not break the delta chain running through
  // them.
  return appendRecord(RecordKind::Rest, elapsedMicros, payload, error);
}

bool TapeWriter::finish(std::string& error) {
  if (finished_) return true;
  const std::vector<std::uint8_t> empty;
  if (!appendRecord(RecordKind::End, header_.durationMicros, empty, error)) {
    return false;
  }

  // Rewrite the header now the counts are known.
  stream_.seekp(0, std::ios::beg);
  stream_.write(reinterpret_cast<const char*>(&header_), sizeof(header_));
  stream_.flush();
  if (!stream_) {
    error = "Unable to finalise tape header";
    return false;
  }
  stream_.close();
  finished_ = true;
  return true;
}

bool TapeReader::open(const std::filesystem::path& path, std::string& error) {
  stream_.open(path, std::ios::binary | std::ios::in);
  if (!stream_) {
    error = "Unable to open tape: " + path.string();
    return false;
  }

  stream_.read(reinterpret_cast<char*>(&fileHeader_), sizeof(fileHeader_));
  if (!stream_) {
    error = "Tape is too short to contain a header";
    return false;
  }
  if (std::memcmp(fileHeader_.magic, kMagic, sizeof(kMagic)) != 0) {
    error = "Not an LMU tape";
    return false;
  }
  if (fileHeader_.formatVersion != kTapeFormatVersion) {
    error = "Unsupported tape format version";
    return false;
  }
  if (fileHeader_.endianMarker != kEndianMarker) {
    error = "Tape was recorded with a different byte order";
    return false;
  }
  if (fileHeader_.snapshotSize != kSnapshotSize) {
    // The shared-memory struct changed since the tape was made, so its bytes
    // no longer mean what this build would read them as.
    error = "Tape snapshot size does not match this build's LMU struct";
    return false;
  }

  recordsOffset_ = stream_.tellg();
  current_.assign(kSnapshotSize, 0);
  hasCurrent_ = false;
  return true;
}

TapeReadResult TapeReader::readNext(
    TapeRecordHeader& record,
    LMUObjectOut& snapshot,
    std::string& restPath,
    std::string& restBody,
    std::string& error) {
  stream_.read(reinterpret_cast<char*>(&record), sizeof(record));
  if (stream_.eof()) return TapeReadResult::EndOfFile;
  if (!stream_) {
    error = "Unable to read tape record header";
    return TapeReadResult::Error;
  }
  if (record.recordHeaderSize != sizeof(TapeRecordHeader)) {
    error = "Tape record header size does not match";
    return TapeReadResult::Error;
  }
  if (record.payloadSize > kMaxPayloadSize) {
    error = "Tape record payload is implausibly large";
    return TapeReadResult::Error;
  }

  scratch_.resize(record.payloadSize);
  if (record.payloadSize > 0) {
    stream_.read(
        reinterpret_cast<char*>(scratch_.data()),
        static_cast<std::streamsize>(record.payloadSize));
    if (!stream_) {
      error = "Tape record payload is truncated";
      return TapeReadResult::Error;
    }
    if (checksum(scratch_.data(), scratch_.size()) != record.payloadChecksum) {
      error = "Tape record payload failed its checksum";
      return TapeReadResult::Error;
    }
  }

  const auto kind = static_cast<RecordKind>(record.kind);
  if (kind == RecordKind::Keyframe) {
    if (!decodeRuns(
            scratch_.data(),
            scratch_.size(),
            current_.data(),
            kSnapshotSize)) {
      error = "Tape keyframe did not decode to a whole snapshot";
      return TapeReadResult::Error;
    }
    hasCurrent_ = true;
  } else if (kind == RecordKind::Delta) {
    if (!hasCurrent_) {
      error = "Tape delta arrived before any keyframe";
      return TapeReadResult::Error;
    }
    std::vector<std::uint8_t> delta(kSnapshotSize);
    if (!decodeRuns(
            scratch_.data(), scratch_.size(), delta.data(), kSnapshotSize)) {
      error = "Tape delta did not decode to a whole snapshot";
      return TapeReadResult::Error;
    }
    xorInto(current_.data(), delta.data(), kSnapshotSize, current_.data());
  } else if (kind == RecordKind::Disconnect) {
    hasCurrent_ = false;
  } else if (kind == RecordKind::Rest) {
    TapeRestPayloadHeader restHeader{};
    if (scratch_.size() < sizeof(restHeader)) {
      error = "Tape REST record is too short for its header";
      return TapeReadResult::Error;
    }
    std::memcpy(&restHeader, scratch_.data(), sizeof(restHeader));
    const std::size_t expected =
        sizeof(restHeader) + restHeader.pathSize + restHeader.bodySize;
    if (expected != scratch_.size()) {
      error = "Tape REST record size does not match its header";
      return TapeReadResult::Error;
    }
    const char* cursor =
        reinterpret_cast<const char*>(scratch_.data()) + sizeof(restHeader);
    restPath.assign(cursor, restHeader.pathSize);
    restBody.assign(cursor + restHeader.pathSize, restHeader.bodySize);
  }

  if (hasCurrent_) {
    std::memcpy(&snapshot, current_.data(), kSnapshotSize);
  }
  return TapeReadResult::Record;
}

bool TapeReader::rewind(std::string& error) {
  stream_.clear();
  stream_.seekg(recordsOffset_, std::ios::beg);
  if (!stream_) {
    error = "Unable to rewind tape";
    return false;
  }
  std::fill(current_.begin(), current_.end(), static_cast<std::uint8_t>(0));
  hasCurrent_ = false;
  return true;
}

}  // namespace irdashies::lmu_replay
