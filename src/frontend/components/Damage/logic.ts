/** TinyPedal default suspension damage thresholds (fraction damaged). */
export const SUSP_THRESHOLDS = {
  light: 0.02,
  medium: 0.15,
  heavy: 0.4,
  totaled: 0.8,
} as const;

/** Remaining tread at or below this is treated as a puncture. */
export const PUNCTURE_WEAR = 0.01;

export type BodyDamageTier = 'ok' | 'light' | 'heavy' | 'detached';
export type SuspDamageTier =
  'ok' | 'light' | 'medium' | 'heavy' | 'totaled' | 'detached';

/** Chassis outline colours (grey when OK, yellow/red when dented). */
export const BODY_FILL: Record<BodyDamageTier, string> = {
  ok: '#52525b',
  light: '#facc15',
  heavy: '#ef4444',
  detached: '#27272a',
};

/** Suspension bar / chevron OK accent (matches wheel teal). */
export const SUSP_OK_ACCENT = '#2dd4bf';

export const SUSP_FILL: Record<SuspDamageTier, string> = {
  ok: '#2dd4bf',
  light: '#facc15',
  medium: '#f97316',
  heavy: '#ef4444',
  totaled: '#ef4444',
  detached: '#27272a',
};

export const CORNER_LABELS = ['LF', 'RF', 'LR', 'RR'] as const;
export const CORNER_OK_BG = '#134e4a';

export const bodyTier = (severity: number): BodyDamageTier => {
  if (severity >= 3) return 'detached';
  if (severity === 2) return 'heavy';
  if (severity === 1) return 'light';
  return 'ok';
};

const BODY_TIER_RANK: Record<BodyDamageTier, number> = {
  ok: 0,
  light: 1,
  heavy: 2,
  detached: 3,
};

export const worstBodyTier = (
  ...severities: readonly number[]
): BodyDamageTier => {
  let worst: BodyDamageTier = 'ok';
  for (const severity of severities) {
    const tier = bodyTier(severity);
    if (BODY_TIER_RANK[tier] > BODY_TIER_RANK[worst]) worst = tier;
  }
  return worst;
};

/** Per-panel remaining integrity from LMU dent severity 0..3. */
export const panelIntegrity = (severity: number): number => {
  if (!Number.isFinite(severity) || severity <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - Math.min(severity, 2) / 2));
};

/** Min integrity across panel severities; null when empty. */
export const panelsIntegrity = (
  severities: readonly number[]
): number | null => {
  if (severities.length === 0) return null;
  return Math.min(...severities.map(panelIntegrity));
};

export const suspTier = (
  detached: boolean,
  damage: number | undefined
): SuspDamageTier => {
  if (detached) return 'detached';
  if (damage === undefined || !Number.isFinite(damage) || damage < 0) {
    return 'ok';
  }
  if (damage < SUSP_THRESHOLDS.light) return 'ok';
  if (damage < SUSP_THRESHOLDS.medium) return 'light';
  if (damage < SUSP_THRESHOLDS.heavy) return 'medium';
  if (damage < SUSP_THRESHOLDS.totaled) return 'heavy';
  return 'totaled';
};

/** Wheel colour from remaining tread when suspension damage is unavailable. */
export const tyreWearTier = (wear: number | undefined): SuspDamageTier => {
  if (wear === undefined || !Number.isFinite(wear)) return 'ok';
  if (wear <= PUNCTURE_WEAR) return 'detached';
  if (wear < 0.2) return 'heavy';
  if (wear < 0.5) return 'medium';
  if (wear < 0.8) return 'light';
  return 'ok';
};

/**
 * Centre integrity reading, matching TinyPedal damage.py:
 * prefer aero damage when available (≥0), else body dent average / 16.
 */
export const integrityFraction = (
  aeroDamage: number | undefined,
  dentSeverity: readonly number[],
  preferAero = true
): number | null => {
  let damage: number;
  if (
    preferAero &&
    aeroDamage !== undefined &&
    Number.isFinite(aeroDamage) &&
    aeroDamage >= 0
  ) {
    damage = aeroDamage;
  } else if (dentSeverity.length > 0) {
    damage = dentSeverity.reduce((sum, v) => sum + v, 0) / 16;
  } else {
    return null;
  }
  return Math.max(0, Math.min(1, 1 - damage));
};

export const aeroIntegrity = (
  aeroDamage: number | undefined
): number | null => {
  if (
    aeroDamage === undefined ||
    !Number.isFinite(aeroDamage) ||
    aeroDamage < 0
  )
    return null;
  return Math.max(0, Math.min(1, 1 - aeroDamage));
};

export const bodyIntegrity = (
  dentSeverity: readonly number[]
): number | null => {
  if (dentSeverity.length === 0) return null;
  return Math.max(
    0,
    Math.min(1, 1 - dentSeverity.reduce((sum, v) => sum + v, 0) / 16)
  );
};

export const suspensionIntegrity = (
  suspensionDamage: readonly number[],
  wheelDetached: readonly boolean[]
): number | null => {
  const valid = suspensionDamage.filter((v) => Number.isFinite(v) && v >= 0);
  if (valid.length > 0) {
    return Math.max(0, Math.min(1, 1 - Math.max(...valid)));
  }
  if (wheelDetached.some(Boolean)) return 0;
  return null;
};

export const tyreIntegrity = (tyreWear: readonly number[]): number | null => {
  const valid = tyreWear.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return Math.max(0, Math.min(1, Math.min(...valid)));
};

export const isPunctured = (wear: number | undefined): boolean =>
  wear !== undefined && Number.isFinite(wear) && wear <= PUNCTURE_WEAR;

export const formatIntegrityPct = (value: number | null): string => {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
};

/** Corner remaining integrity from suspension damage or puncture. */
export const cornerIntegrity = (
  detached: boolean,
  suspensionDamage: number | undefined,
  tyreWear: number | undefined,
  preferSuspension: boolean
): number | null => {
  if (detached) return 0;
  if (preferSuspension) {
    if (
      suspensionDamage === undefined ||
      !Number.isFinite(suspensionDamage) ||
      suspensionDamage < 0
    ) {
      return null;
    }
    if (suspensionDamage < SUSP_THRESHOLDS.light) return 1;
    return Math.max(0, Math.min(1, 1 - suspensionDamage));
  }
  if (tyreWear === undefined || !Number.isFinite(tyreWear)) return null;
  if (isPunctured(tyreWear)) return 0;
  return null;
};

/** Format only when below full integrity; otherwise null (hide label). */
export const formatDamagedPct = (value: number | null): string | null => {
  if (value === null || value >= 0.995) return null;
  return formatIntegrityPct(value);
};

/**
 * Coarse iRacing body hint when panel dents are not in the SDK.
 * Mandatory repair → heavy, optional-only → light, else ok.
 */
export const iracingBodyTier = (
  repairNeeded: boolean,
  optRepairNeeded: boolean
): BodyDamageTier => {
  if (repairNeeded) return 'heavy';
  if (optRepairNeeded) return 'light';
  return 'ok';
};

export interface DamageSnapshot {
  dentSeverity: number[];
  wheelDetached: boolean[];
  suspensionDamage: number[];
  tyreWear: number[];
  aeroDamage: number | undefined;
  repairTime: number | undefined;
  optRepairTime: number | undefined;
  repairNeeded: boolean;
  optRepairNeeded: boolean;
  /** iRacing EngineWarnings bitfield for fluid / temp / stall icons. */
  engineWarnings?: number;
}

/** True when the car has reportable damage (not ordinary tyre wear). */
export const hasCarDamage = (data: DamageSnapshot): boolean => {
  if (data.repairNeeded || data.optRepairNeeded) return true;
  if ((data.repairTime ?? 0) > 0 || (data.optRepairTime ?? 0) > 0) return true;
  if (data.dentSeverity.some((v) => v > 0)) return true;
  if (data.wheelDetached.some(Boolean)) return true;
  if (
    data.aeroDamage !== undefined &&
    Number.isFinite(data.aeroDamage) &&
    data.aeroDamage > 0
  ) {
    return true;
  }
  if (
    data.suspensionDamage.some(
      (v) => Number.isFinite(v) && v >= SUSP_THRESHOLDS.light
    )
  ) {
    return true;
  }
  if (data.tyreWear.some((wear) => isPunctured(wear))) return true;
  return false;
};

const DEMO_DAMAGE_BASE: DamageSnapshot = {
  dentSeverity: [1, 0, 2, 0, 0, 0, 1, 0],
  wheelDetached: [false, false, false, false],
  suspensionDamage: [0.01, 0.2, 0.05, 0.5],
  tyreWear: [0.92, 0.88, 0.005, 0.75],
  aeroDamage: 0.18,
  repairTime: 12.5,
  optRepairTime: 4.0,
  repairNeeded: true,
  optRepairNeeded: true,
  engineWarnings: 0x01,
};

/** Static pack for stories / specs. */
export const DEMO_DAMAGE: DamageSnapshot = DEMO_DAMAGE_BASE;

const DEMO_WARNING_CYCLE = [
  0x01, // water temp
  0x04, // oil pressure
  0x40, // oil temp
  0x02, // fuel pressure
  0x08, // stalled
  0,
] as const;

/** Demo snapshot at `elapsedSec` — body/suspension/tyres and repair timers move. */
export const getDemoDamage = (elapsedSec = 0): DamageSnapshot => {
  const repairCycle = 20;
  const optCycle = 8;
  const repairTime = Math.max(
    0,
    repairCycle - (elapsedSec % (repairCycle + 2))
  );
  const optRepairTime = Math.max(0, optCycle - (elapsedSec % (optCycle + 2)));

  const wave = (offset: number, period: number) =>
    0.5 + 0.5 * Math.sin((elapsedSec + offset) * ((Math.PI * 2) / period));

  const dentOf = (offset: number) => {
    const v = wave(offset, 14);
    if (v > 0.85) return 2;
    if (v > 0.55) return 1;
    return 0;
  };

  const suspOf = (offset: number) => {
    const v = wave(offset, 10);
    if (v < 0.2) return 0.01;
    if (v < 0.55) return 0.12;
    if (v < 0.8) return 0.35;
    return 0.55;
  };

  const tyreOf = (offset: number, punctureAt: number) => {
    const phase = (elapsedSec + offset) % 24;
    if (phase > punctureAt && phase < punctureAt + 4) return 0.005;
    return 0.55 + 0.4 * wave(offset, 18);
  };

  return {
    dentSeverity: [
      dentOf(0),
      dentOf(2),
      dentOf(4),
      dentOf(1.5),
      dentOf(3.5),
      dentOf(5),
      dentOf(6.5),
      dentOf(8),
    ],
    wheelDetached: [false, false, wave(9, 30) > 0.92, false],
    suspensionDamage: [suspOf(0), suspOf(2.5), suspOf(5), suspOf(7.5)],
    tyreWear: [tyreOf(0, 16), tyreOf(3, 20), tyreOf(6, 12), tyreOf(9, 18)],
    aeroDamage: 0.05 + 0.35 * wave(1, 16),
    repairTime,
    optRepairTime,
    repairNeeded: repairTime > 0,
    optRepairNeeded: optRepairTime > 0,
    engineWarnings:
      DEMO_WARNING_CYCLE[
        Math.floor(elapsedSec / 3) % DEMO_WARNING_CYCLE.length
      ],
  };
};

export const UNDAMAGED: DamageSnapshot = {
  dentSeverity: [0, 0, 0, 0, 0, 0, 0, 0],
  wheelDetached: [false, false, false, false],
  suspensionDamage: [0, 0, 0, 0],
  tyreWear: [1, 1, 1, 1],
  aeroDamage: 0,
  repairTime: undefined,
  optRepairTime: undefined,
  repairNeeded: false,
  optRepairNeeded: false,
  engineWarnings: 0,
};
