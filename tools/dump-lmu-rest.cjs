/**
 * Prints a recorded REST body out of an LMU tape.
 *
 * Usage:
 *   node tools/dump-lmu-rest.cjs <tape.lmudt> <path> [speed]
 *   node tools/dump-lmu-rest.cjs session.lmudt /rest/garage/UIScreen/RepairAndRefuel
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
// Set before the addon loads: it reads the replay configuration at load time,
// which is the order the tape spec uses.
process.env.IRDASHIES_LMU_REPLAY = process.argv[2];
process.env.IRDASHIES_LMU_REPLAY_SPEED = process.argv[4] || '50';
process.env.IRDASHIES_LMU_REPLAY_LOOP = '0';
const addon = require(path.resolve('build/Release/lmu_tape_node.node'));
const want = process.argv[3];
const paths = [
  '/rest/garage/UIScreen/RepairAndRefuel',
  '/rest/garage/UIScreen/CarSetupOverview',
  '/rest/sessions',
  '/rest/sessions/weather',
  '/rest/strategy/pitstop-estimate',
];
const sdk = new addon.LmuSdkNode();
sdk.start();
const seen = new Map();
const deadline = Date.now() + 60000;
let reads = 0;
let running = 0;
while (Date.now() < deadline) {
  const r = sdk.read();
  reads += 1;
  if (r && r.running) running += 1;
  for (const p of paths) {
    if (!seen.has(p)) {
      const b = sdk.readRest(p);
      if (b) seen.set(p, b);
    }
  }
  if (seen.size === paths.length) break;
}
sdk.stop();
console.error(
  `reads=${reads} running=${running} found=${seen.size}/${paths.length}`
);
for (const [p, b] of seen) console.error(`  ${p}: ${b.length} bytes`);
const body = seen.get(want);
if (!body) process.exit(1);
try {
  console.log(JSON.stringify(JSON.parse(body), null, 1));
} catch {
  console.log(body.slice(0, 6000));
}
