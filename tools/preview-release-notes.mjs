import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { normalizeVersion } from '../src/app/releaseNotes/version.ts';

const { values } = parseArgs({
  options: {
    previous: { type: 'string' },
    current: { type: 'string', default: '2.1.0' },
    state: { type: 'string', default: 'preview' },
    live: { type: 'boolean', default: false },
  },
});
if (
  !normalizeVersion(values.current) ||
  (values.previous && !normalizeVersion(values.previous))
) {
  throw new Error(
    '--current and --previous must be semantic versions, for example 2.1.0'
  );
}
if (!/^[a-zA-Z0-9_-]{1,40}$/.test(values.state)) {
  throw new Error(
    '--state must contain 1–40 letters, numbers, underscores or hyphens'
  );
}
const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['start'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      IRDASHIES_RELEASE_NOTES_CURRENT: values.current,
      IRDASHIES_RELEASE_NOTES_PREVIOUS: values.previous ?? '',
      IRDASHIES_RELEASE_NOTES_STATE: values.state,
      IRDASHIES_RELEASE_NOTES_LIVE: values.live ? '1' : '0',
    },
  }
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
