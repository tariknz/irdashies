import { spawn } from 'node:child_process';
import path from 'node:path';

function optionValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

const arguments_ = process.argv.slice(2);
const input = optionValue(arguments_, '--input');
if (!input) {
  process.stderr.write(
    'Usage: npm run irsdk:replay:app -- --input <capture.irdt> ' +
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
  } else if (path.extname(input).toLowerCase() !== '.irdt') {
    process.stderr.write('--input must be an .irdt telemetry tape\n');
    process.exitCode = 2;
  } else {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['start'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        IRDASHIES_TELEMETRY_REPLAY: path.resolve(input),
        IRDASHIES_TELEMETRY_REPLAY_SPEED: speedText,
        IRDASHIES_TELEMETRY_REPLAY_LOOP: arguments_.includes('--loop')
          ? '1'
          : '0',
      },
    });
    child.on('error', (error) => {
      process.stderr.write(`Could not start irDashies: ${error.message}\n`);
      process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
      process.exitCode = code ?? (signal ? 1 : 0);
    });
  }
}
