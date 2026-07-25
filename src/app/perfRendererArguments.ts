export interface RendererPerfConfig {
  enabled: boolean;
  runId: string;
  scenario: string;
  reportIntervalMs: number;
}

const PERF_ARGUMENT = '--irdashies-perf-metrics';
const RUN_ID_ARGUMENT = '--irdashies-perf-run-id=';
const SCENARIO_ARGUMENT = '--irdashies-perf-scenario=';
const INTERVAL_ARGUMENT = '--irdashies-perf-interval-ms=';

function safeValue(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 120) || fallback;
}

export function createRendererPerfArguments(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (env.PERF_METRICS !== '1') return [];

  const interval = Number(env.PERF_REPORT_INTERVAL_MS);
  const reportIntervalMs =
    Number.isFinite(interval) && interval >= 1000 ? interval : 10_000;

  return [
    PERF_ARGUMENT,
    `${RUN_ID_ARGUMENT}${safeValue(env.PERF_RUN_ID, 'manual')}`,
    `${SCENARIO_ARGUMENT}${safeValue(env.PERF_SCENARIO, 'unspecified')}`,
    `${INTERVAL_ARGUMENT}${reportIntervalMs}`,
  ];
}

export function readRendererPerfArguments(
  args: string[] = process.argv
): RendererPerfConfig {
  const valueAfter = (prefix: string): string | undefined =>
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const interval = Number(valueAfter(INTERVAL_ARGUMENT));

  return {
    enabled: args.includes(PERF_ARGUMENT),
    runId: safeValue(valueAfter(RUN_ID_ARGUMENT), 'manual'),
    scenario: safeValue(valueAfter(SCENARIO_ARGUMENT), 'unspecified'),
    reportIntervalMs:
      Number.isFinite(interval) && interval >= 1000 ? interval : 10_000,
  };
}
