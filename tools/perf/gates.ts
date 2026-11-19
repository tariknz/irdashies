export const PERF_GATES = {
  averageFpsPercent: { minimum: -2, unit: '%' },
  onePercentLowFpsPercent: { minimum: -5, unit: '%' },
  processTelemetryP99Ms: { maximum: 3, unit: 'ms' },
  minimumTickRateHz: { minimum: 20, unit: 'Hz' },
  privateMemorySlopeMBPerMinute: { maximum: 5, unit: 'MB/min' },
  framesOver50MsPercent: { maximum: 0.1, unit: '%' },
} as const;

export const MIN_ANALYSIS_SECONDS = 300;

export const COMPARISON_CONTRASTS = [
  'overlay',
  'widgets',
  'channels',
  'scenario',
] as const;

export type ComparisonContrast = readonly ((typeof COMPARISON_CONTRASTS)[number])[];

export function parseComparisonContrast(values: readonly string[]): ComparisonContrast {
  const parsed = values.map((value) => value.trim().toLowerCase());
  const invalid = parsed.filter(
    (value) => !(COMPARISON_CONTRASTS as readonly string[]).includes(value)
  );
  if (invalid.length > 0)
    throw new Error(
      `Invalid comparison contrast: ${invalid.join(', ')}. Expected ${COMPARISON_CONTRASTS.join(', ')}.`
    );
  return [...new Set(parsed)] as ComparisonContrast;
}

export function contrastDescription(contrast: ComparisonContrast): string {
  return contrast.length > 0 ? contrast.join(', ') : 'none';
}

export const comparisonCheckSatisfied = (check: {
  passed: boolean | null;
  target: string;
}): boolean =>
  check.passed === true ||
  (check.passed === null && check.target.startsWith('not-applicable:'));
