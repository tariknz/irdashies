import { runDiagnosisCli, DIAGNOSE_USAGE } from './diagnose.ts';
import { runDoctorCli, DOCTOR_USAGE } from './doctor.ts';

const args = process.argv.slice(2);
const usage = `${DIAGNOSE_USAGE}\n${DOCTOR_USAGE}`;

if (!args.length || args.includes('--help') || args.includes('-h')) {
  process.stdout.write(usage);
} else if (args[0] === 'doctor') {
  try {
    await runDoctorCli(args.slice(1));
  } catch (error) {
    process.stderr.write(
      `Doctor failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
} else if (args[0] === 'diagnose') {
  try {
    await runDiagnosisCli(args.slice(1));
  } catch (error) {
    process.stderr.write(
      `Diagnosis failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
} else {
  process.stderr.write(`Unknown perf command: ${args[0]}\n${usage}`);
  process.exitCode = 1;
}
