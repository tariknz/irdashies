// The replay source: a recorded tape standing in for LMU's shared memory.
//
// Links against the same lmu_node.cc as the production addon, so a tape goes
// through the real snapshot-to-JS conversion rather than a mock of it.
//
// Configured out of band, like the iRacing replay launcher:
//   IRDASHIES_LMU_REPLAY        tape path
//   IRDASHIES_LMU_REPLAY_SPEED  playback speed, 0.25 to 100
//   IRDASHIES_LMU_REPLAY_LOOP   "1" to restart at the end
//
// The reader and its position are per-instance, which matters more here than
// for shared memory: a tape has a read cursor, so two instances sharing one
// would each consume frames the other expected to see.

#include "../lmu_source.h"
#include "lmu_tape.h"

#include <chrono>
#include <cstdlib>
#include <memory>
#include <map>
#include <string>

namespace irdashies::lmu {
namespace {

using irdashies::lmu_replay::RecordKind;
using irdashies::lmu_replay::TapeReader;
using irdashies::lmu_replay::TapeReadResult;
using irdashies::lmu_replay::TapeRecordHeader;

constexpr double kMinSpeed = 0.25;
constexpr double kMaxSpeed = 100.0;

std::uint64_t nowMicros() {
  using namespace std::chrono;
  return static_cast<std::uint64_t>(
      duration_cast<microseconds>(steady_clock::now().time_since_epoch())
          .count());
}

std::string envOrEmpty(const char* name) {
#ifdef _WIN32
  char* value = nullptr;
  std::size_t size = 0;
  if (_dupenv_s(&value, &size, name) != 0 || value == nullptr) return {};
  std::string result(value);
  std::free(value);
  return result;
#else
  const char* value = std::getenv(name);
  return value == nullptr ? std::string{} : std::string{value};
#endif
}

}  // namespace

struct LmuSource::Impl {
  std::unique_ptr<TapeReader> reader;
  LMUObjectOut pending{};
  bool hasPending = false;
  /** Set by a Disconnect record, so the player reports the sim going away. */
  bool disconnected = false;
  bool exhausted = false;
  double speed = 1.0;
  bool loop = false;
  std::uint64_t startedAtMicros = 0;
  std::uint64_t pendingAtMicros = 0;
  /**
   * Latest recorded body per REST path.
   *
   * A tape's REST records are interleaved with its snapshots, so the app sees
   * whatever had most recently been served at that point in the recording --
   * which is what the live poller would have been holding too.
   */
  std::map<std::string, std::string> restBodies;

  /** Reads the next snapshot record, skipping the bookkeeping ones. */
  bool advance() {
    if (!reader) return false;

    while (true) {
      TapeRecordHeader record{};
      std::string error;
      std::string restPath;
      std::string restBody;
      const auto result =
          reader->readNext(record, pending, restPath, restBody, error);

      if (result == TapeReadResult::Error) {
        exhausted = true;
        return false;
      }
      if (result == TapeReadResult::EndOfFile) {
        if (!loop || !reader->rewind(error)) {
          exhausted = true;
          return false;
        }
        // A loop boundary is a disconnect: the app sees the session end and a
        // new one begin, which is what a restarted recording actually is.
        startedAtMicros = nowMicros();
        disconnected = true;
        return false;
      }

      const auto kind = static_cast<RecordKind>(record.kind);
      if (kind == RecordKind::Disconnect) {
        disconnected = true;
        return false;
      }
      if (kind == RecordKind::End) {
        if (!loop || !reader->rewind(error)) {
          exhausted = true;
          return false;
        }
        startedAtMicros = nowMicros();
        disconnected = true;
        return false;
      }
      if (kind == RecordKind::Keyframe || kind == RecordKind::Delta) {
        pendingAtMicros = record.elapsedMicros;
        hasPending = true;
        return true;
      }
      if (kind == RecordKind::Rest) {
        restBodies[restPath] = restBody;
        continue;
      }
      // Any other kind is bookkeeping; keep reading.
    }
  }
};

LmuSource::LmuSource() : impl_(std::make_unique<Impl>()) {}

LmuSource::~LmuSource() = default;

bool LmuSource::open() {
  if (impl_->reader) return true;

  const std::string path = envOrEmpty("IRDASHIES_LMU_REPLAY");
  if (path.empty()) return false;

  auto reader = std::make_unique<TapeReader>();
  std::string error;
  if (!reader->open(path, error)) return false;

  const std::string speed = envOrEmpty("IRDASHIES_LMU_REPLAY_SPEED");
  if (!speed.empty()) {
    const double parsed = std::atof(speed.c_str());
    if (parsed >= kMinSpeed && parsed <= kMaxSpeed) impl_->speed = parsed;
  }
  impl_->loop = envOrEmpty("IRDASHIES_LMU_REPLAY_LOOP") == "1";

  impl_->reader = std::move(reader);
  impl_->startedAtMicros = nowMicros();
  impl_->hasPending = false;
  impl_->disconnected = false;
  impl_->exhausted = false;
  return true;
}

void LmuSource::close() {
  impl_->reader.reset();
  impl_->hasPending = false;
  impl_->disconnected = false;
  impl_->exhausted = false;
}

bool LmuSource::capture(LMUObjectOut& out) {
  if (!impl_->reader || impl_->exhausted) return false;

  if (impl_->disconnected) {
    // Reported once, then playback carries on with whatever follows.
    impl_->disconnected = false;
    return false;
  }

  if (!impl_->hasPending && !impl_->advance()) return false;

  // Hold the frame until its recorded moment comes round, so a tape plays at
  // the cadence it was captured at rather than as fast as it can be read.
  const std::uint64_t elapsed = nowMicros() - impl_->startedAtMicros;
  const auto due = static_cast<std::uint64_t>(
      static_cast<double>(impl_->pendingAtMicros) / impl_->speed);
  if (elapsed < due) return false;

  out = impl_->pending;
  impl_->hasPending = false;
  return true;
}

bool LmuSource::restBody(const std::string& path, std::string& out) const {
  const auto found = impl_->restBodies.find(path);
  if (found == impl_->restBodies.end()) return false;
  out = found->second;
  return true;
}

bool LmuSource::isLive(const LMUObjectOut& snapshot) const {
  // The window the tape recorded is long gone, so the live check cannot apply.
  // A tape is live while it still has frames to give.
  (void)snapshot;
  return impl_->reader != nullptr && !impl_->exhausted;
}

}  // namespace irdashies::lmu
