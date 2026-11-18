import { spawn } from 'node:child_process';
import path from 'node:path';
import { runDiagnosisCli, DIAGNOSE_USAGE } from './diagnose.ts';
import { runDoctorCli, DOCTOR_USAGE } from './doctor.ts';

const DELEGATED_COMMANDS: Record<string, string> = {
  run: 'tools/perf/run.ts',
  analyze: 'tools/perf/analyze.ts',
  ab: 'tools/perf/ab.ts',
  trace: 'tools/perf/trace.ts',
  'trace-analyze': 'tools/perf/analyzeTrace.ts',
  branches: 'tools/perf/branches.ts',
  'branch-ab': 'tools/perf/branches.ts',
  report: 'tools/perf/report.ts',
};

const DELEGATED_USAGE = `
Other perf commands (also available as npm scripts):
  perf run [options]             Capture a benchmark run
  perf analyze <log> [options]   Summarize or compare captures
  perf ab [options]              Run an observer/empty/full/widget matrix
  perf trace [options]           Record and summarize a DevTools trace
  perf trace-analyze <file>      Re-analyse an existing trace JSON
  perf branches [options]        A/B replay against two git refs
  perf report <summary.json>...  Aggregate several comparison summaries
`;

const args = process.argv.slice(2);
const usage = `${DIAGNOSE_USAGE}\n${DOCTOR_USAGE}${DELEGATED_USAGE}`;

const runDelegated = async (script: string, commandArgs: string[]) => {
  const child = spawn(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      path.resolve(script),
      ...commandArgs,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: 'inherit',
    }
  );
  const forwardInterrupt = () => child.kill('SIGINT');
  const forwardTermination = () => child.kill('SIGTERM');
  process.once('SIGINT', forwardInterrupt);
  process.once('SIGTERM', forwardTermination);
  try {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    process.exitCode = exitCode ?? 1;
  } finally {
    process.removeListener('SIGINT', forwardInterrupt);
    process.removeListener('SIGTERM', forwardTermination);
  }
};

if (
  !args.length ||
  args[0] === '--help' ||
  args[0] === '-h'
) {
  process.stdout.write(usage);
} else {
  const [command, ...rest] = args;
  if (command === 'doctor') {
    try {
      await runDoctorCli(rest);
    } catch (error) {
      process.stderr.write(
        `Doctor failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  } else if (command === 'diagnose') {
    try {
      await runDiagnosisCli(rest);
    } catch (error) {
      process.stderr.write(
        `Diagnosis failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  } else if (DELEGATED_COMMANDS[command]) {
    await runDelegated(DELEGATED_COMMANDS[command], rest);
  } else {
    process.stderr.write(`Unknown perf command: ${command}\n${usage}`);
    process.exitCode = 1;
  }
}
