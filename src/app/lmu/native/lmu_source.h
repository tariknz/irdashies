#ifndef IRDASHIES_LMU_SOURCE_H
#define IRDASHIES_LMU_SOURCE_H

#include <memory>
#include <string>

#include "lmu_struct.h"

namespace irdashies::lmu {

/**
 * Where LMU snapshots come from.
 *
 * The production addon reads the sim's shared memory; the replay addon reads a
 * recorded tape. Each build links exactly one implementation of this, so
 * everything above it -- every line that turns a snapshot into the JS objects
 * the app consumes -- is the same code either way, and a tape exercises the
 * real mapping rather than a stand-in for it.
 *
 * The same arrangement irsdk_node.cc has with irsdk_utils.cpp and
 * irsdk_tape_utils.cpp.
 *
 * One instance owns one attachment, and that is load-bearing rather than
 * tidiness. There is routinely more than one LmuSdkNode alive: auto-detection
 * builds a probe to answer "is LMU running?" and the bridge builds its own
 * reader once a sim is chosen. While this state was file-scope, those two
 * shared a single mapping, so whichever was released first -- including by the
 * probe's destructor, whenever V8 got round to collecting it -- unmapped the
 * view the other was still reading, and the survivor saw every capture fail as
 * though LMU had quit.
 *
 * Hence pimpl: the seam stays a single type with one declaration, while each
 * implementation keeps whatever state it needs (a handle and a view; a tape
 * reader and its position) privately in its own translation unit.
 */
class LmuSource {
 public:
  LmuSource();
  ~LmuSource();

  // An attachment is owned, not shared; copying one would double-release it.
  LmuSource(const LmuSource&) = delete;
  LmuSource& operator=(const LmuSource&) = delete;

  /** Attaches to the source. Safe to call when already attached. */
  bool open();

  /** Releases it. Safe to call when not attached. */
  void close();

  /**
   * Copies the next snapshot worth having, false when there is none.
   *
   * Shared memory returns false for a torn read; a tape returns false once it
   * has run out, or while it is waiting for the next frame's turn.
   */
  bool capture(LMUObjectOut& out);

  /**
   * Whether this snapshot represents a sim that is actually there.
   *
   * Shared memory checks the window handle the snapshot names is still a
   * window. A tape cannot: the window it recorded died with the session. So
   * this is part of the seam rather than something the addon can decide for
   * itself.
   */
  bool isLive(const LMUObjectOut& snapshot) const;

  /**
   * The most recently served body for a REST path, when the source has one.
   *
   * Part of the seam because only a tape does. LMU's local REST API carries
   * things shared memory does not, and the live build reaches it over HTTP
   * from the JS side -- so the shared-memory implementation returns false and
   * the tape serves what it recorded, which is what lets a recording
   * reproduce a REST-dependent session.
   */
  bool restBody(const std::string& path, std::string& out) const;

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

}  // namespace irdashies::lmu

#endif
