/**
 * Prints a recorded REST body out of an LMU tape.
 *
 * Usage:
 *   node tools/dump-lmu-rest.cjs <tape.lmudt> <path> [speed] [--timeout <s>]
 *   node tools/dump-lmu-rest.cjs session.lmudt /rest/garage/UIScreen/RepairAndRefuel
 *
 * The tape plays once at `speed` (default 50x) until the path's first body
 * turns up or the tape ends. `--timeout` caps the wall-clock wait in seconds;
 * the default, 0, has no cap.
 *
 * Exit codes: 0 printed the body; 1 the tape ended without it; 2 bad usage;
 * 3 the scan stopped before the tape ended (timeout, or the tape never began
 * playing), so the path may still be recorded later in it.
 *
 * The tape is opened through the replay addon exactly as a replay would, so
 * what this prints is what the poller would have been served. Read only; it
 * never writes to the tape -- which is worth saying, because `fixture` takes a
 * path as its *output* and will overwrite a recording handed to it by mistake.
 *
 * Written because several questions about LMU's REST shapes -- what the pit
 * menu carries, which fields exist, what scale a value is on -- are answerable
 * from a tape already on disk, and were being guessed at instead.
 *
 * The replay configuration is read when the addon loads, so the environment
 * has to be set before the require below. Getting that order wrong yields a
 * snapshot that never reports running, with no error.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script. */
const path = require('node:path');

const USAGE =
  'Usage: node tools/dump-lmu-rest.cjs <tape.lmudt> <path> [speed] [--timeout <s>]';
const args = process.argv.slice(2);
let timeoutSeconds = 0;
const timeoutIndex = args.indexOf('--timeout');
if (timeoutIndex !== -1) {
  timeoutSeconds = Number(args[timeoutIndex + 1]);
  args.splice(timeoutIndex, 2);
}
const [tape, want, speed = '50'] = args;
if (!tape || !want || !Number.isFinite(timeoutSeconds) || timeoutSeconds < 0) {
  console.error(USAGE);
  process.exit(2);
}

// Set before the addon loads: it reads the replay configuration at load time,
// which is the order the tape spec uses.
process.env.IRDASHIES_LMU_REPLAY = tape;
process.env.IRDASHIES_LMU_REPLAY_SPEED = speed;
process.env.IRDASHIES_LMU_REPLAY_LOOP = '0';
const addon = require(path.resolve('build/Release/lmu_tape_node.node'));

/** A tape that has not produced its first frame by now is not going to. */
const START_GRACE_MS = 10_000;

const sdk = new addon.LmuSdkNode();
sdk.start();
const startedAt = Date.now();
const deadline = timeoutSeconds > 0 ? startedAt + timeoutSeconds * 1000 : 0;
let reads = 0;
let recordedSeconds = 0;
let playing = false;
let outcome = 'timeout';
let body;
// Only the requested path is polled, and the first body ends the scan. A
// tape stays running through a recorded disconnect and stops only once it is
// exhausted, so running then not running is the end of the tape.
while (true) {
  const snapshot = sdk.read();
  reads += 1;
  if (snapshot?.running) recordedSeconds = snapshot.currentET;
  body = sdk.readRest(want);
  if (body) {
    outcome = 'found';
    break;
  }
  if (sdk.isRunning()) {
    playing = true;
  } else if (playing) {
    outcome = 'ended';
    break;
  } else if (Date.now() - startedAt > START_GRACE_MS) {
    outcome = 'never-started';
    break;
  }
  if (deadline && Date.now() >= deadline) break;
}
sdk.stop();

const scanned = `reads=${reads}, reached ${recordedSeconds.toFixed(0)}s of session time`;
if (outcome === 'found') {
  console.error(`${want}: ${body.length} bytes (${scanned})`);
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 1));
  } catch {
    console.log(body.slice(0, 6000));
  }
} else if (outcome === 'ended') {
  console.error(`${want}: not in the tape (scanned to its end; ${scanned})`);
  process.exit(1);
} else if (outcome === 'never-started') {
  console.error(
    `Scan incomplete: the tape did not start playing within ${START_GRACE_MS / 1000}s. Is ${tape} an LMU tape?`
  );
  process.exit(3);
} else {
  console.error(
    `Scan incomplete: stopped after ${timeoutSeconds}s before the tape ended (${scanned}). ${want} may be recorded later; raise --timeout or the speed.`
  );
  process.exit(3);
}
