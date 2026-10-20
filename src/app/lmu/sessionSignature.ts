import type { LmuRawSession } from './native';

/**
 * Cheap change detection for the session snapshot.
 *
 * Built by appending primitives to a string rather than with JSON.stringify,
 * which this used to do. The loop computes a signature on every session poll
 * -- twice a second, whatever else is happening -- and stringifying a nested
 * object means walking it, quoting every key and escaping every value, for a
 * result nothing ever reads. Only equality matters, so the cheapest thing that
 * changes whenever a watched field changes is enough.
 *
 * Still a string and not a hash: a hash would need a collision argument, and a
 * missed change here shows as standings that silently stop updating.
 */

/** Separates fields so neighbouring values cannot run together into one. */
const SEP = '\u0001';

/**
 * The entries on the grid: who is here and in what.
 *
 * Split from the rest because it changes for a different reason. A driver
 * joining or leaving is a burst -- LMU admits them one per session poll, so a
 * grid loading in is twenty roster changes in ten seconds, each one forcing a
 * full rebuild and a whole-snapshot broadcast. The bridge watches this half on
 * its own so it can let a burst settle, which it cannot do with one signature
 * covering both.
 */
export const lmuRosterSignature = (session: LmuRawSession): string => {
  let out = `${session.numVehicles}`;
  for (const driver of session.drivers) {
    out += SEP;
    out += driver.id;
    out += SEP;
    out += driver.name;
    out += SEP;
    out += driver.vehicleName;
    out += SEP;
    out += driver.vehicleModel ?? '';
    out += SEP;
    out += driver.className;
    out += SEP;
    out += driver.vehFilename;
    out += SEP;
    out += driver.classId;
  }
  return out;
};

/**
 * Everything else worth republishing for: session settings, conditions, and
 * each driver's state.
 *
 * The fitted compound indices are here for the same reason again: a pit stop
 * onto a compound no other car is running adds a name/index pair that
 * DriverTires has to carry, and nothing else would have changed.
 *
 * `control` is here because mapLmuSession derives CarIsAI and
 * CarIsAIControlled from it, and an AI takeover on its own used to leave those
 * flags stale until some other tracked field happened to move. `place` is here
 * for the same reason: without it an overtake changed nothing the signature
 * could see, so the standings held their old order until somebody completed a
 * lap.
 */
export const lmuStateSignature = (session: LmuRawSession): string => {
  let out = '';
  out += session.trackName;
  out += SEP;
  out += session.session;
  out += SEP;
  out += session.playerHasVehicle ? session.playerVehicleIdx : -1;
  out += SEP;
  out += session.lapDist;
  out += SEP;
  out += session.gameVersion;
  out += SEP;
  out += session.cloudCoverage;
  out += SEP;
  out += session.wind;
  out += SEP;
  out += session.raining;
  out += SEP;
  out += session.maxPlayers;
  out += SEP;
  out += session.maxLaps;
  out += SEP;
  out += session.isFixedSetup;
  out += SEP;
  out += session.engineMaxRPM;
  out += SEP;
  out += session.fuelCapacity;
  out += SEP;
  out += session.maxGears;
  out += SEP;
  out += session.frontTireCompoundName;

  for (const driver of session.drivers) {
    out += SEP;
    out += driver.isPlayer;
    out += SEP;
    out += driver.control;
    out += SEP;
    out += driver.qualification;
    out += SEP;
    out += driver.place;
    out += SEP;
    out += driver.bestLapTime;
    out += SEP;
    out += driver.lastLapTime;
    out += SEP;
    out += driver.totalLaps;
    out += SEP;
    out += driver.estimatedLapTime;
    // The fitted compound, which DriverInfo.DriverTires is built from. Without
    // it a pit stop onto a compound nobody else was running left the index
    // unnamed until some other watched field moved.
    out += SEP;
    out += driver.frontTireCompoundIndex ?? -1;
    out += SEP;
    out += driver.rearTireCompoundIndex ?? -1;
  }
  return out;
};

/**
 * The whole signature: the roster and the state together.
 *
 * Kept as one value because a rebuild is still driven by either half changing.
 * The bridge needs the halves separately only to decide whether to wait.
 */
export const lmuSessionSignature = (session: LmuRawSession): string =>
  `${lmuRosterSignature(session)}${SEP}${lmuStateSignature(session)}`;
