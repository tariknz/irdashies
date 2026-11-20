import { constants } from 'node:fs';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { choiceArgument, parseArguments } from './args.ts';
import { collectHostFacts } from './hostFacts.ts';
import { inspectIbtRecording } from './ibt.ts';

export const DOCTOR_USAGE = `Usage: npm run perf -- doctor [options]
  --target dev|packaged  Benchmark target to preflight (default dev)
  --input <file>         Optional .ibt or .irdt recording to check
  --format md|json       Output format (default md)
`;

export type DoctorStatus = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  detail: string;
}

export interface DoctorOptions {
  target: 'dev' | 'packaged';
  inputPath?: string;
  format: 'md' | 'json';
}

export interface DoctorReport {
  target: 'dev' | 'packaged';
  checks: DoctorCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    skipped: number;
  };
}

interface ProjectPackage {
  engines?: { node?: string };
  scripts?: Record<string, string>;
}

export function parseDoctorOptions(args: string[]): DoctorOptions {
  const parsed = parseArguments(args, {
    usage: DOCTOR_USAGE,
    values: ['--target', '--input', '--format'],
  });
  const target = choiceArgument(
    parsed,
    '--target',
    ['dev', 'packaged'] as const,
    'dev'
  );
  const format = choiceArgument(
    parsed,
    '--format',
    ['md', 'json'] as const,
    'md'
  );
  const input = parsed.value('--input');
  return {
    target,
    format,
    inputPath: input ? path.resolve(input) : undefined,
  };
}

export function summarizeDoctorChecks(
  checks: DoctorCheck[]
): DoctorReport['summary'] {
  return {
    passed: checks.filter((check) => check.status === 'PASS').length,
    warnings: checks.filter((check) => check.status === 'WARN').length,
    failed: checks.filter((check) => check.status === 'FAIL').length,
    skipped: checks.filter((check) => check.status === 'SKIP').length,
  };
}

const isDirectoryWritable = async (directory: string): Promise<boolean> => {
  let current = path.resolve(directory);
  for (;;) {
    let stats: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stats = await fs.stat(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return false;
      current = parent;
      continue;
    }
    if (stats.isDirectory()) {
      try {
        await fs.access(current, constants.W_OK);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
};

const readIrdtHeader = async (
  inputPath: string
): Promise<{ valid: boolean; variableCount: number; detail: string }> => {
  const handle = await fs.open(inputPath, 'r');
  try {
    const buffer = Buffer.alloc(96);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < buffer.length)
      return {
        valid: false,
        variableCount: 0,
        detail: 'Truncated tape header.',
      };
    const magic = buffer.subarray(0, 8).toString('ascii');
    const formatVersion = buffer.readUInt32LE(8);
    const endianMarker = buffer.readUInt32LE(12);
    const fileHeaderSize = buffer.readUInt32LE(16);
    const sdkHeaderSize = buffer.readUInt32LE(20);
    const variableHeaderSize = buffer.readUInt32LE(24);
    const variableCount = buffer.readUInt32LE(28);
    if (
      magic !== 'IRDTRCE\0' ||
      formatVersion !== 1 ||
      endianMarker !== 0x01020304 ||
      fileHeaderSize !== 96 ||
      sdkHeaderSize !== 112 ||
      variableHeaderSize !== 144 ||
      variableCount < 1 ||
      variableCount > 4096
    )
      return {
        valid: false,
        variableCount,
        detail: 'Unsupported or invalid telemetry tape header.',
      };
    return {
      valid: true,
      variableCount,
      detail: `Readable telemetry tape with a valid header and ${variableCount} variables.`,
    };
  } finally {
    await handle.close();
  }
};

const isGitLfsPointer = async (inputPath: string): Promise<boolean> => {
  const handle = await fs.open(inputPath, 'r');
  try {
    const buffer = Buffer.alloc(128);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer
      .subarray(0, bytesRead)
      .toString('utf8')
      .startsWith('version https://git-lfs.github.com/spec/v1');
  } finally {
    await handle.close();
  }
};

const readCpuGovernor = async (): Promise<string | undefined> => {
  try {
    const value = await fs.readFile(
      '/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor',
      'utf8'
    );
    return value.trim() || undefined;
  } catch {
    return undefined;
  }
};

const iracingProcessRunning = (): boolean => {
  try {
    const output = execFileSync(
      process.platform === 'win32' ? 'tasklist' : 'pgrep',
      process.platform === 'win32'
        ? ['/FI', 'IMAGENAME eq iRacing.exe']
        : ['-f', 'iRacing'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return process.platform === 'win32' ? /iRacing/i.test(output) : true;
  } catch {
    return false;
  }
};

const checkRecording = async (inputPath: string): Promise<DoctorCheck> => {
  const extension = path.extname(inputPath).toLowerCase();
  if (extension !== '.ibt' && extension !== '.irdt') {
    return {
      name: 'Replay recording',
      status: 'FAIL',
      detail: 'Input must use the .ibt or .irdt format.',
    };
  }
  try {
    await fs.access(inputPath, constants.R_OK);
    const stats = await fs.stat(inputPath);
    if (!stats.isFile() || stats.size === 0) {
      return {
        name: 'Replay recording',
        status: 'FAIL',
        detail: 'Input is not a non-empty regular file.',
      };
    }
    if (await isGitLfsPointer(inputPath)) {
      return {
        name: 'Replay recording',
        status: 'FAIL',
        detail:
          'This is a Git LFS pointer, not the recording. Fetch the media with git lfs pull.',
      };
    }
    if (extension === '.irdt') {
      const header = await readIrdtHeader(inputPath);
      return {
        name: 'Replay recording',
        status: header.valid ? 'PASS' : 'FAIL',
        detail: header.detail,
      };
    }
    const ibt = await inspectIbtRecording(inputPath, stats.size);
    return {
      name: 'Replay recording',
      status: ibt.valid ? 'PASS' : 'FAIL',
      detail: ibt.detail,
    };
  } catch (error) {
    return {
      name: 'Replay recording',
      status: 'FAIL',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};

const packageRoot = path.resolve('.');

export async function collectDoctorChecks(
  options: DoctorOptions
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const recordingCheck = options.inputPath
    ? await checkRecording(options.inputPath)
    : undefined;
  const host = collectHostFacts();
  checks.push({
    name: 'Host hardware',
    status: 'PASS',
    detail: `${host.hostCpuModel}; ${host.hostLogicalCores} logical cores; ${host.hostTotalMemoryGB} GB RAM; ${host.hostPlatform}/${host.hostArch} ${host.hostRelease}. Recorded in scenario metadata.`,
  });
  checks.push({
    name: 'Display session',
    status:
      process.env.SSH_CONNECTION || process.env.SSH_TTY ? 'WARN' : 'PASS',
    detail: `${host.hostDisplayServer}${process.env.SSH_CONNECTION || process.env.SSH_TTY ? ' over a remote session; frame pacing may not represent a local desktop.' : ' local display detected.'}`,
  });
  const governor = await readCpuGovernor();
  checks.push({
    name: 'CPU frequency governor',
    status:
      process.platform !== 'linux'
        ? 'SKIP'
        : governor === undefined
          ? 'SKIP'
          : governor === 'performance'
            ? 'PASS'
            : 'WARN',
    detail:
      process.platform !== 'linux'
        ? 'Linux governor probe is not available on this platform.'
        : governor === undefined
          ? 'scaling_governor is not exposed; check the host power policy manually.'
          : `${governor}; use the performance governor for comparable CPU timings.`,
  });
  const perfMetricsSource = await fs
    .readFile(path.join(packageRoot, 'src/app/perfMetrics.ts'), 'utf8')
    .catch(() => '');
  checks.push({
    name: 'Private-memory instrumentation',
    status: perfMetricsSource.includes('privateMemorySampler')
      ? 'PASS'
      : 'WARN',
    detail: perfMetricsSource.includes('privateMemorySampler')
      ? 'This checkout samples /proc private memory on Linux.'
      : 'No Linux private-memory sampler in this checkout; the memory gate will be inconclusive for replay runs.',
  });
  const freeRatio = os.freemem() / Math.max(1, os.totalmem());
  const simulatorRunning = iracingProcessRunning();
  checks.push({
    name: 'Available memory',
    status: freeRatio < 0.1 ? 'WARN' : 'PASS',
    detail: `${(freeRatio * 100).toFixed(1)}% of physical memory is currently free.`,
  });
  checks.push({
    name: 'Simulator process',
    status: simulatorRunning
      ? 'PASS'
      : recordingCheck?.status === 'PASS'
        ? 'SKIP'
        : 'WARN',
    detail: simulatorRunning
      ? 'iRacing is running; live comparisons should keep the session and camera fixed.'
      : recordingCheck?.status === 'PASS'
        ? 'iRacing is not running; a valid replay recording was supplied.'
        : 'iRacing is not running; use --replay-input for isolated captures.',
  });
  let projectPackage: ProjectPackage | undefined;
  try {
    projectPackage = JSON.parse(
      await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8')
    ) as ProjectPackage;
  } catch {
    checks.push({
      name: 'Project package metadata',
      status: 'FAIL',
      detail: 'Could not read package.json from the current directory.',
    });
  }

  const requiredNodeMajor = Number(
    projectPackage?.engines?.node?.match(/>=\s*(\d+)/)?.[1]
  );
  const currentNodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push(
    Number.isFinite(requiredNodeMajor) && currentNodeMajor >= requiredNodeMajor
      ? {
          name: 'Node.js version',
          status: 'PASS',
          detail: `Node ${process.versions.node} satisfies the project requirement >=${requiredNodeMajor}.`,
        }
      : {
          name: 'Node.js version',
          status: 'FAIL',
          detail: `Node ${process.versions.node} does not satisfy the project requirement ${projectPackage?.engines?.node ?? '(unknown)'}.`,
        }
  );

  for (const dependency of ['electron', 'tsx', 'ws']) {
    try {
      await fs.access(path.join(packageRoot, 'node_modules', dependency));
      checks.push({
        name: `${dependency} dependency`,
        status: 'PASS',
        detail: 'Installed in node_modules.',
      });
    } catch {
      checks.push({
        name: `${dependency} dependency`,
        status: 'FAIL',
        detail: 'Missing from node_modules; run npm install.',
      });
    }
  }

  const replayAddon =
    process.platform === 'win32'
      ? 'irsdk_node_replay.node'
      : 'irsdk_tape_node.node';
  try {
    await fs.access(path.join(packageRoot, 'build', 'Release', replayAddon));
    checks.push({
      name: 'Native replay addon',
      status: 'PASS',
      detail: 'Built addon is available for recorded telemetry replay.',
    });
  } catch {
    checks.push({
      name: 'Native replay addon',
      status: 'FAIL',
      detail: `Missing build/Release/${replayAddon}; run npm run irsdk:build.`,
    });
  }

  const outputDirectory = path.join(packageRoot, 'perf-results');
  checks.push(
    (await isDirectoryWritable(outputDirectory))
      ? {
          name: 'Results directory',
          status: 'PASS',
          detail: `${outputDirectory} or its parent is writable.`,
        }
      : {
          name: 'Results directory',
          status: 'FAIL',
          detail: `${outputDirectory} and its parent are not writable.`,
        }
  );

  try {
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const sourceDirty =
      execFileSync('git', ['status', '--porcelain'], {
        cwd: packageRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().length > 0;
    checks.push({
      name: 'Source provenance',
      status: sourceDirty ? 'WARN' : 'PASS',
      detail: `${sourceCommit} (${sourceDirty ? 'dirty' : 'clean'} worktree); perf:run records both values.`,
    });
  } catch {
    checks.push({
      name: 'Source provenance',
      status: 'WARN',
      detail:
        'Git revision is unavailable; run metadata cannot identify this source tree.',
    });
  }

  if (options.target === 'packaged') {
    const appPath = path.join(
      packageRoot,
      'out/irdashies-win32-x64/irdashies.exe'
    );
    if (process.platform !== 'win32') {
      checks.push({
        name: 'Packaged benchmark target',
        status: 'FAIL',
        detail: 'The packaged perf:run target is currently Windows-only.',
      });
    } else {
      try {
        await fs.access(appPath, constants.X_OK);
        checks.push({
          name: 'Packaged benchmark target',
          status: 'PASS',
          detail: `${appPath} is available.`,
        });
      } catch {
        checks.push({
          name: 'Packaged benchmark target',
          status: 'FAIL',
          detail: `${appPath} is missing; run npm run package.`,
        });
      }
    }
  } else {
    checks.push({
      name: 'Development benchmark target',
      status: projectPackage?.scripts?.start ? 'PASS' : 'FAIL',
      detail: projectPackage?.scripts?.start
        ? 'npm start is configured.'
        : 'The package has no npm start script.',
    });
  }

  checks.push(
    recordingCheck ?? {
      name: 'Replay recording',
      status: 'SKIP',
      detail: 'No --input supplied; recording validation was skipped.',
    }
  );

  const publisherPath = path.join(
    packageRoot,
    'build/Release/irsdk_replay.exe'
  );
  if (process.platform === 'win32') {
    try {
      await fs.access(publisherPath, constants.X_OK);
      checks.push({
        name: 'perf:run replay publisher',
        status: 'PASS',
        detail: 'Native replay publisher is available for --replay-input runs.',
      });
    } catch {
      checks.push({
        name: 'perf:run replay publisher',
        status: 'WARN',
        detail:
          'Missing build/Release/irsdk_replay.exe; run npm run irsdk:build for perf:run --replay-input.',
      });
    }
  } else {
    checks.push({
      name: 'perf:run replay publisher',
      status: 'SKIP',
      detail:
        'Not required on Linux: perf:run --replay-input uses the in-process native tape addon instead of a separate publisher.',
    });
  }

  checks.push({
    name: 'Live iRacing connection',
    status: 'SKIP',
    detail: 'Not probed; doctor does not connect to or launch iRacing.',
  });

  return checks;
}

export function createDoctorReport(
  target: DoctorOptions['target'],
  checks: DoctorCheck[]
): DoctorReport {
  return {
    target,
    checks,
    summary: summarizeDoctorChecks(checks),
  };
}

export function doctorMarkdown(report: DoctorReport): string {
  return [
    '# irDashies perf CLI doctor',
    '',
    `Target: ${report.target}. Checks are read-only; no application was launched.`,
    '',
    ...report.checks.map(
      (check) => `- [${check.status}] ${check.name}: ${check.detail}`
    ),
    '',
    `Summary: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed, ${report.summary.skipped} skipped.`,
    '',
  ].join('\n');
}

export async function runDoctorCli(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(DOCTOR_USAGE);
    return;
  }
  const options = parseDoctorOptions(args);
  const report = createDoctorReport(
    options.target,
    await collectDoctorChecks(options)
  );
  process.stdout.write(
    options.format === 'json'
      ? `${JSON.stringify(report, null, 2)}\n`
      : doctorMarkdown(report)
  );
  if (report.summary.failed > 0) process.exitCode = 1;
}
