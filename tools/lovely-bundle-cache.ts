import { readFile } from 'node:fs/promises';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Returns the age of a fresh bundle, or null when it needs fetching. */
export async function getFreshBundleAgeMs(
  outputFile: string,
  now = Date.now()
): Promise<number | null> {
  try {
    const bundle: unknown = JSON.parse(await readFile(outputFile, 'utf8'));
    if (
      typeof bundle !== 'object' ||
      bundle === null ||
      !('timestamp' in bundle) ||
      typeof bundle.timestamp !== 'number' ||
      !Number.isFinite(bundle.timestamp) ||
      bundle.timestamp <= 0
    ) {
      return null;
    }

    // Git checkout and file copying change mtime without refreshing the data.
    const age = now - bundle.timestamp;
    return age >= 0 && age < MAX_AGE_MS ? age : null;
  } catch {
    // Missing, unreadable, and malformed bundles cannot establish freshness.
    return null;
  }
}
