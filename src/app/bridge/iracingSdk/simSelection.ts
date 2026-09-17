export type Simulator = 'iracing' | 'lmu';

export function getSimulatorOverride(
  argv: string[],
  envValue: string | undefined
): Simulator | undefined {
  const value =
    argv.find((argument) => argument.startsWith('--sim='))?.slice(6) ??
    envValue;
  return value === 'iracing' || value === 'lmu' ? value : undefined;
}

export function selectDetectedSimulator(
  iracingActive: boolean,
  lmuActive: boolean
): Simulator | undefined {
  if (lmuActive) return 'lmu';
  if (iracingActive) return 'iracing';
  return undefined;
}
