// Actual-simulator replay capture. No fabricated telemetry or runtime patches.
// Local, private profile copies and raw output stay in ignored perf-results/.
/* eslint-disable @typescript-eslint/no-require-imports -- Plain-Node CommonJS controller loads the existing N-API addon. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const cwd = path.resolve(__dirname, '../..');
const out = path.join(cwd, 'perf-results');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keys = [
  'IsReplayPlaying',
  'IsOnTrack',
  'ReplayFrameNum',
  'ReplayFrameNumEnd',
  'ReplayPlaySpeed',
  'ReplaySessionTime',
  'SessionTime',
  'SessionNum',
  'CamCarIdx',
  'CamGroupNumber',
  'CamCameraNumber',
  'FrameRate',
  'PlayerCarIdx',
];
const print = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
const save = (file, value) =>
  fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2));
const sha256 = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function manifest(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? manifest(file)
        : [[path.relative(cwd, file).replaceAll('\\', '/'), sha256(file)]];
    })
    .sort(([a], [b]) => a.localeCompare(b));
}
fs.mkdirSync(out, { recursive: true });
// Use a private copy: holding build/Release's addon open prevents Forge from
// rebuilding that file on Windows before the application starts.
const controlAddon = path.join(out, 'control-addon.node');
if (!fs.existsSync(controlAddon))
  fs.copyFileSync(
    path.join(cwd, 'build/Release/irsdk_node.node'),
    controlAddon
  );
const sdk = new (require(controlAddon).iRacingSdkNode)();
function snapshot() {
  sdk.waitForData(1000);
  const vars = sdk.getTelemetryData();
  return Object.fromEntries(
    keys.map((key) => {
      const v = vars[key];
      const T = {
        1: Int8Array,
        2: Int32Array,
        3: Int32Array,
        4: Float32Array,
        5: Float64Array,
      }[v?.varType];
      return [key, v && T ? new T(v.value)[0] : null];
    })
  );
}
async function seek(start) {
  sdk.broadcast(3, 0, 0);
  await sleep(300);
  sdk.broadcast(4, 0, start.ReplayFrameNum);
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(500);
    const actual = snapshot();
    if (
      actual.SessionNum === start.SessionNum &&
      Math.abs(actual.ReplayFrameNum - start.ReplayFrameNum) <= 2 &&
      actual.ReplayPlaySpeed === 0
    ) {
      if (
        actual.CamCarIdx !== start.CamCarIdx ||
        actual.CamGroupNumber !== start.CamGroupNumber ||
        actual.CamCameraNumber !== start.CamCameraNumber
      )
        throw new Error(
          'Camera changed; restore camera explicitly before capture'
        );
      return actual;
    }
  }
  throw new Error('Replay seek was not verified');
}
async function main() {
  if (!sdk.startSDK()) throw new Error('SDK not connected');
  const command = process.argv[2] || 'status';
  const before = snapshot();
  if (!before.IsReplayPlaying)
    throw new Error('Actual simulator replay required');
  if (command === 'status') return print(before);
  if (command === 'save-original') {
    if (fs.existsSync(path.join(out, 'full-original.json')))
      throw new Error('Original already saved');
    save('full-original.json', before);
    return print(before);
  }
  if (command === 'restore') {
    const original = read('full-original.json');
    await seek(original);
    sdk.broadcast(3, original.ReplayPlaySpeed, 0);
    await sleep(500);
    const actual = snapshot();
    if (actual.ReplayPlaySpeed !== original.ReplayPlaySpeed)
      throw new Error('Original playback speed not restored');
    save('full-restored.json', actual);
    return print(actual);
  }
  if (command !== 'run')
    throw new Error('Expected status|save-original|restore|run');
  const runId = process.argv[3];
  const duration = Number(process.argv[4] || 420);
  if (!/^[a-z0-9-]+$/.test(runId || '') || ![90, 420].includes(duration))
    throw new Error('Expected safe run ID and 90 or 420 seconds');
  const start = read('full-start.json');
  const reset = await seek(start);
  const profile = path.join(out, `${runId}.profile`);
  fs.cpSync(path.join(out, 'full-profile-seed'), profile, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  const env = {
    ...process.env,
    NODE_OPTIONS: '',
    VSCODE_INSPECTOR_OPTIONS: '',
    IRDASHIES_SIM: 'iracing',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.IRDASHIES_IRSDK_REPLAY;
  delete env.IRDASHIES_TELEMETRY_REPLAY;
  const provenance = {
    runId,
    target: 'dev',
    duration,
    reset,
    profile: path.basename(profile),
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
    }).trim(),
    launch: new Date().toISOString(),
  };
  const log = fs.createWriteStream(path.join(out, `${runId}.runner.log`));
  const replay = fs.createWriteStream(path.join(out, `${runId}.replay.jsonl`));
  save(`${runId}.provenance.json`, provenance);
  const child = spawn(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      'tools/perf/run.ts',
      '--target',
      'dev',
      '--mode',
      'full',
      '--user-data-dir',
      profile,
      '--scenario',
      `${provenance.gitHead.slice(0, 8)}-full-saved-profile-actual-replay`,
      '--run-id',
      runId,
      '--duration-seconds',
      String(duration),
      '--field-count',
      '59',
      '--class-count',
      '2',
      '--display-geometry',
      '7680x1440',
      '--fps-cap',
      '84',
      '--simulator-mode',
      'replay',
    ],
    { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let played = false;
  let chunks = '';
  const sample = () =>
    replay.write(
      JSON.stringify({ timestamp: new Date().toISOString(), ...snapshot() }) +
        '\n'
    );
  let timer;
  function output(chunk) {
    log.write(chunk);
    chunks = (chunks + chunk.toString()).slice(-20000);
    if (!played && chunks.includes('[PerfRunOrigin:JSON]')) {
      played = true;
      sdk.broadcast(3, 1, 0);
      provenance.playCommand = new Date().toISOString();
      provenance.buildFiles = manifest(path.join(cwd, '.vite/build'));
      provenance.buildManifestSha256 = crypto
        .createHash('sha256')
        .update(JSON.stringify(provenance.buildFiles))
        .digest('hex');
      provenance.nativeAddonSha256 = sha256(
        path.join(cwd, '.vite/build/Release/irsdk_node.node')
      );
      provenance.seedConfigSha256 = sha256(
        path.join(out, 'full-profile-seed/config.json')
      );
      provenance.versions = {
        node: process.version,
        electron: require('electron/package.json').version,
        react: require('react/package.json').version,
      };
      save(`${runId}.provenance.json`, provenance);
      sample();
      timer = setInterval(sample, 5000);
      print({
        captureReady: runId,
        focus: 'iRacing',
        timestamp: provenance.playCommand,
      });
    }
  }
  child.stdout.on('data', output);
  child.stderr.on('data', output);
  const code = await new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
  });
  clearInterval(timer);
  sdk.broadcast(3, 0, 0);
  await sleep(300);
  provenance.end = snapshot();
  provenance.exitCode = code;
  provenance.ended = new Date().toISOString();
  save(`${runId}.provenance.json`, provenance);
  replay.end();
  log.end();
  print(provenance);
  if (code || !played) process.exitCode = 1;
}
main()
  .catch((error) => {
    process.stderr.write(error.stack + '\n');
    process.exitCode = 1;
  })
  .finally(() => sdk.stopSDK());
