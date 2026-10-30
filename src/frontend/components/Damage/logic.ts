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
  | 'ok'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'totaled'
  | 'detached';

/** Fill colours for SVG body panels (native iRacing-style wireframe). */
export const BODY_FILL: Record<BodyDamageTier, string> = {
  ok: '#64748b',
  light: '#facc15',
  heavy: '#ef4444',
  detached: '#0f172a',
};

export const SUSP_FILL: Record<SuspDamageTier, string> = {
  ok: '#10b981',
  light: '#facc15',
  medium: '#f97316',
  heavy: '#d946ef',
  totaled: '#2563eb',
  detached: '#0f172a',
};

export const bodyTier = (severity: number): BodyDamageTier => {
  if (severity >= 3) return 'detached';
  if (severity === 2) return 'heavy';
  if (severity === 1) return 'light';
  return 'ok';
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

export const aeroIntegrity = (aeroDamage: number | undefined): number | null => {
  if (aeroDamage === undefined || !Number.isFinite(aeroDamage) || aeroDamage < 0)
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
};

/** Static pack for stories / specs. */
export const DEMO_DAMAGE: DamageSnapshot = DEMO_DAMAGE_BASE;

/** Demo snapshot at `elapsedSec` with repair times counting down. */
export const getDemoDamage = (elapsedSec = 0): DamageSnapshot => {
  const repairCycle = 20;
  const optCycle = 8;
  const repairTime = Math.max(0, repairCycle - (elapsedSec % (repairCycle + 2)));
  const optRepairTime = Math.max(0, optCycle - (elapsedSec % (optCycle + 2)));
  return {
    ...DEMO_DAMAGE_BASE,
    repairTime,
    optRepairTime,
    repairNeeded: repairTime > 0,
    optRepairNeeded: optRepairTime > 0,
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
};
