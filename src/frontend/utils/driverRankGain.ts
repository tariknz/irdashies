/**
 * Approximate LMU Driver Rank change for the current race result.
 *
 * Port of doX SimHub's UpdateEstimatedDriverRankGainData: Elo expected score
 * against each class rival, then K-scaled (actual − expected) with a small
 * qualifying weight. The result is shown as a rounded percent, matching doX
 * dashboards (+12% / −5%).
 *
 * Defaults match doX (K=30, D=420, log=10, internal scale=3, quali weight
 * 15/85). Event-specific multipliers from RaceControl are not applied.
 */

export interface DriverRankGainInput<D = unknown> {
  driver: D;
  /** Class position in the race, 1-based. */
  racePosition: number;
  /** Class position from qualifying, 1-based; 0 when unknown. */
  qualiPosition: number;
  /**
   * Visual score = parsed rank score × 100 (Bronze 3 @ 70% → 370).
   * Same units doX stores before multiplying by the internal scale.
   */
  visualScore: number;
}

export interface DriverRankGainResult<D = unknown> {
  driver: D;
  /** Approximate progress-bar change in doX's display units (percent points). */
  estimatedGain: number;
}

const INTERNAL_SCALE = 3;
const QUALY_WEIGHT = 0.17647058823529413;
const DEFAULT_K = 30;
const DEFAULT_D = 420;
const DEFAULT_LOG = 10;
const DEFAULT_MULTIPLIER = 1;

const RANK_INDEX: Record<string, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Platinum: 3,
};

export const normaliseDriverRankProgress = (
  progress: number | undefined
): number => {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, progress));
};

/**
 * doX TryParseDriverRankScore × 100. Undefined for Pro or unknown ranks.
 */
export const driverRankVisualScore = (
  rank: string | undefined,
  tier: number | undefined,
  progress: number | undefined
): number | undefined => {
  if (!rank) return undefined;
  const rankIndex = RANK_INDEX[rank];
  if (rankIndex === undefined) return undefined;

  let level =
    typeof tier === 'number' && Number.isFinite(tier) ? Math.trunc(tier) : 0;
  if (rankIndex === 0) {
    level = Math.max(0, Math.min(3, level));
  } else {
    level = Math.max(1, Math.min(3, level));
  }

  const pct = normaliseDriverRankProgress(progress);
  const score =
    rankIndex === 0
      ? level + pct / 100
      : 4 + (rankIndex - 1) * 3 + (level - 1) + pct / 100;
  const visual = score * 100;
  return visual > 0 && Number.isFinite(visual) ? visual : undefined;
};

const expectedScore = (
  myInternal: number,
  otherInternal: number,
  d: number,
  logBase: number
): number => {
  if (!(d > 0) || !(logBase > 1)) return 0.5;
  const denom = 1 + Math.pow(logBase, (otherInternal - myInternal) / d);
  if (!(denom > 0) || !Number.isFinite(denom)) return 0.5;
  return 1 / denom;
};

const headToHead = (myPosition: number, otherPosition: number): number => {
  if (myPosition <= 0 || otherPosition <= 0) return 0.5;
  if (myPosition < otherPosition) return 1;
  if (myPosition > otherPosition) return 0;
  return 0.5;
};

export function calculateDriverRankGain<D>(
  entries: DriverRankGainInput<D>[],
  options?: {
    multiplier?: number;
    k?: number;
    d?: number;
    logBase?: number;
  }
): DriverRankGainResult<D>[] {
  const usable = entries.filter(
    (e) =>
      e.racePosition > 0 && Number.isFinite(e.visualScore) && e.visualScore > 0
  );
  if (usable.length < 2) return [];

  const multiplier =
    options?.multiplier && options.multiplier > 0
      ? options.multiplier
      : DEFAULT_MULTIPLIER;
  const k = options?.k && options.k > 0 ? options.k : DEFAULT_K;
  const d = options?.d && options.d > 0 ? options.d : DEFAULT_D;
  const logBase =
    options?.logBase && options.logBase > 1 ? options.logBase : DEFAULT_LOG;

  const scale = (multiplier * k) / (2 * (usable.length - 1));
  const internals = usable.map((e) => e.visualScore * INTERNAL_SCALE);

  return usable.map((entry, i) => {
    let raceDelta = 0;
    let qualiDelta = 0;
    for (let j = 0; j < usable.length; j++) {
      if (i === j) continue;
      const other = usable[j];
      const expected = expectedScore(internals[i], internals[j], d, logBase);
      raceDelta +=
        headToHead(entry.racePosition, other.racePosition) - expected;
      if (entry.qualiPosition > 0 && other.qualiPosition > 0) {
        qualiDelta +=
          headToHead(entry.qualiPosition, other.qualiPosition) - expected;
      }
    }
    let gain = scale * (raceDelta + QUALY_WEIGHT * qualiDelta);
    if (!Number.isFinite(gain)) gain = 0;
    return { driver: entry.driver, estimatedGain: gain };
  });
}
