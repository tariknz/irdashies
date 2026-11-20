import { spawn } from 'node:child_process';
import path from 'node:path';

function optionValue(arguments_, name) {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

export function launchReplay({ command, extension, tapeName, envPrefix, sim }) {
  const args = process.argv.slice(2);
  const input = optionValue(args, '--input');
  const speedText = args.includes('--speed')
    ? optionValue(args, '--speed')
    : '1';
  const speed = Number(speedText);

  if (!input) {
    process.stderr.write(
      `Usage: npm run ${command} -- --input <capture${extension}> [--speed <0.25-100>] [--loop]\n`
    );
    process.exitCode = 2;
    return;
  }
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 100) {
    process.stderr.write('--speed must be between 0.25 and 100\n');
    process.exitCode = 2;
    return;
  }
  if (path.extname(input).toLowerCase() !== extension) {
    process.stderr.write(`--input must be an ${extension} ${tapeName} tape\n`);
    process.exitCode = 2;
    return;
  }

  const env = {
    ...process.env,
    [envPrefix]: path.resolve(input),
    [`${envPrefix}_SPEED`]: speedText,
    [`${envPrefix}_LOOP`]: args.includes('--loop') ? '1' : '0',
  };
  if (sim) env.IRDASHIES_SIM = sim;
  // Node refuses to spawn .cmd/.bat without a shell (the CVE-2024-27980
  // mitigation, Node >= 18.20 / 20.12), so Windows needs one or the spawn
  // throws EINVAL. The command goes in as a single string rather than a
  // command plus argument vector because Node 24 emits DEP0190 whenever a
  // non-empty args array meets shell: true. Nothing user-supplied reaches
  // the command line either way — the tape path and speed travel through
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
