import { spawn } from 'node:child_process';
import path from 'node:path';

// Launches irDashies against a recorded LMU tape. The LMU counterpart of
// run-telemetry-replay.mjs, and it works the same way: nothing about the app
// changes, the replay addon is selected by an environment variable that the
// native loader reads.

function optionValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

const arguments_ = process.argv.slice(2);
const input = optionValue(arguments_, '--input');
if (!input) {
  process.stderr.write(
    'Usage: npm run lmu:replay:app -- --input <capture.lmudt> ' +
      '[--speed <0.25-100>] [--loop]\n'
  );
  process.exitCode = 2;
} else {
  const speedIndex = arguments_.indexOf('--speed');
  const speedText =
    speedIndex === -1 ? '1' : optionValue(arguments_, '--speed');
  const speed = Number(speedText);
  if (
    speedText === undefined ||
    !Number.isFinite(speed) ||
    speed < 0.25 ||
    speed > 100
  ) {
    process.stderr.write('--speed must be between 0.25 and 100\n');
    process.exitCode = 2;
  } else if (path.extname(input).toLowerCase() !== '.lmudt') {
    process.stderr.write('--input must be an .lmudt LMU tape\n');
    process.exitCode = 2;
  } else {
    const env = {
      ...process.env,
      IRDASHIES_LMU_REPLAY: path.resolve(input),
      IRDASHIES_LMU_REPLAY_SPEED: speedText,
      IRDASHIES_LMU_REPLAY_LOOP: arguments_.includes('--loop') ? '1' : '0',
      // Pin the source: auto-detection probes for a running sim, and a tape is
      // not one. Without this the app would sit waiting for iRacing or LMU to
      // appear rather than playing what it was given.
      IRDASHIES_SIM: 'lmu',
    };
    // Node refuses to spawn .cmd/.bat without a shell (the CVE-2024-27980
    // mitigation, Node >= 18.20 / 20.12), so Windows needs one or the spawn
    // throws EINVAL. The command goes in as a single string rather than a
    // command plus argument vector because Node 24 emits DEP0190 whenever a
    // non-empty args array meets shell: true. Nothing user-supplied reaches
    // the command line either way -- the tape path and speed travel through
    // env, so the shell has nothing extra to re-parse.
    const child =
      process.platform === 'win32'
        ? spawn('npm.cmd start', { shell: true, stdio: 'inherit', env })
        : spawn('npm', ['start'], { stdio: 'inherit', env });
    child.on('error', (error) => {
      process.stderr.write(`Could not start irDashies: ${error.message}\n`);
      process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
      process.exitCode = code ?? (signal ? 1 : 0);
    });
  }
}
