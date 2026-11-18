/** Keep the capture bootstrap active while measuring optional reporter cost. */
export function isPerfCollectionEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.PERF_METRICS === '1' && env.PERF_METRICS_COLLECTION !== 'off';
}
