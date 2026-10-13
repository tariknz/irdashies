#ifndef IRDASHIES_LMU_TAPE_H
#define IRDASHIES_LMU_TAPE_H

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "../lmu_struct.h"

namespace irdashies::lmu_replay {

/**
 * 2 added REST records. Version 1 tapes are refused rather than played
 * without them: no tape exists outside a scratch directory, so there is
 * nothing to migrate and a silent half-replay would be worse than a refusal.
 */
constexpr std::uint32_t kTapeFormatVersion = 2;
constexpr std::uint32_t kEndianMarker = 0x01020304;

/**
 * How often a full snapshot is written instead of a delta.
 *
 * A delta is useless without the frame before it, so a tape that was only
 * deltas could not be looped, sought, or resumed after a corrupt record.
 * Every keyframe is a point the reader can start from.
 */
constexpr std::uint32_t kKeyframeInterval = 100;

enum class RecordKind : std::uint32_t {
  /** A complete LMUObjectOut, stored run-length encoded. */
  Keyframe = 1,
  /** XOR against the previous snapshot, run-length encoded. */
  Delta = 2,
  /** The sim went away; the player republishes this as a disconnect. */
  Disconnect = 3,
  End = 4,
  /**
   * A response from LMU's local REST API: the path it came from and the body
   * as served.
   *
   * Shared memory does not carry these -- pit-stop estimates, the pit menu's
   * refuel target, virtual-energy capacity, wear, the weather forecast -- so a
   * tape without them cannot reproduce anything that depends on them.
   *
   * Stored verbatim rather than run-length encoded. These are a few KB of
   * JSON, written only when the body actually changes, so the run encoding
   * that makes a 324,820-byte snapshot viable would cost more than it saves
   * here.
   */
  Rest = 5,
};

#pragma pack(push, 1)
struct TapeFileHeader {
  char magic[8];
  std::uint32_t formatVersion;
  std::uint32_t endianMarker;
  std::uint32_t fileHeaderSize;
  std::uint32_t recordHeaderSize;
  /** sizeof(LMUObjectOut) when recorded. A tape from another build is refused. */
  std::uint32_t snapshotSize;
  std::uint32_t keyframeInterval;
  std::uint64_t recordCount;
  std::uint64_t durationMicros;
  std::uint32_t reserved[8];
};

struct TapeRecordHeader {
  std::uint32_t kind;
  std::uint32_t recordHeaderSize;
  /** Encoded size, not the 324,820 bytes it expands to. */
  std::uint32_t payloadSize;
  std::uint32_t flags;
  /** Since the first frame, so playback can honour the original cadence. */
  std::uint64_t elapsedMicros;
  std::uint32_t payloadChecksum;
  std::uint32_t reserved;
};

/** Prefixes a Rest record's payload: the path, then the body, both raw. */
struct TapeRestPayloadHeader {
  std::uint32_t pathSize;
  std::uint32_t bodySize;
};
#pragma pack(pop)

static_assert(sizeof(TapeFileHeader) == 80, "TapeFileHeader layout changed");
static_assert(sizeof(TapeRecordHeader) == 32, "TapeRecordHeader layout changed");
static_assert(
    sizeof(TapeRestPayloadHeader) == 8,
    "TapeRestPayloadHeader layout changed");

std::uint32_t checksum(const void* data, std::size_t size);

/**
 * Run-length encodes a buffer, which is what makes a raw-struct tape viable.
 *
 * An LMUObjectOut is 324,820 bytes and the sim publishes at 100 Hz, so storing
 * frames verbatim costs about 31 MB a second. Most of that never changes
 * between frames -- the arrays are sized for 104 vehicles whatever the grid --
 * so a keyframe compresses its empty slots and a delta is almost entirely
 * zeroes.
 *
 * The encoding alternates runs: a count of zero bytes, then a count of literal
 * bytes followed by those bytes, repeating. Counts are varints.
 */
void encodeRuns(
    const std::uint8_t* data,
    std::size_t size,
    std::vector<std::uint8_t>& out);

/** Reverses encodeRuns. False when the stream is truncated or overlong. */
bool decodeRuns(
    const std::uint8_t* data,
    std::size_t size,
    std::uint8_t* out,
    std::size_t outSize);

/** XORs cur against prev in place of cur, so unchanged bytes become zero. */
void xorInto(
    const std::uint8_t* prev,
    const std::uint8_t* cur,
    std::size_t size,
    std::uint8_t* out);

class TapeWriter {
 public:
  bool open(const std::filesystem::path& path, std::string& error);

  /** Appends a snapshot, as a keyframe or a delta as the interval dictates. */
  bool appendSnapshot(
      const LMUObjectOut& snapshot,
      std::uint64_t elapsedMicros,
      std::string& error);

  bool appendDisconnect(std::uint64_t elapsedMicros, std::string& error);

  /**
   * Appends a REST response. The caller decides when a body is worth storing;
   * this writes whatever it is given.
   */
  bool appendRest(
      const std::string& path,
      const std::string& body,
      std::uint64_t elapsedMicros,
      std::string& error);

  bool finish(std::string& error);

  std::uint64_t recordCount() const { return header_.recordCount; }

 private:
  bool appendRecord(
      RecordKind kind,
      std::uint64_t elapsedMicros,
      const std::vector<std::uint8_t>& payload,
      std::string& error);

  std::fstream stream_;
  TapeFileHeader header_{};
  std::vector<std::uint8_t> previous_;
  std::vector<std::uint8_t> scratch_;
  std::uint32_t sinceKeyframe_ = 0;
  bool hasPrevious_ = false;
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

  /**
   * Reads the next record, resolving a delta against the running snapshot.
   *
   * `snapshot` is only meaningful for Keyframe and Delta records, and
   * `restPath`/`restBody` only for a Rest record. Both are left untouched for
   * the kinds they do not apply to, so a caller can ignore whichever it does
   * not care about.
   */
  TapeReadResult readNext(
      TapeRecordHeader& record,
      LMUObjectOut& snapshot,
      std::string& restPath,
      std::string& restBody,
      std::string& error);

  bool rewind(std::string& error);

  const TapeFileHeader& fileHeader() const { return fileHeader_; }

 private:
  std::ifstream stream_;
  TapeFileHeader fileHeader_{};
  std::vector<std::uint8_t> current_;
  std::vector<std::uint8_t> scratch_;
  std::streampos recordsOffset_{};
  bool hasCurrent_ = false;
};

}  // namespace irdashies::lmu_replay

#endif
