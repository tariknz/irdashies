export const SUSP_THRESHOLDS = {
  light: 0.02,
  medium: 0.15,
  heavy: 0.4,
  totaled: 0.8,
} as const;

export const PUNCTURE_WEAR = 0.01;
export const PUNCTURE_PRESSURE_KPA = 1;

export const LMU_DENT_PANELS = [1, 0, 7, 2, 6, 3, 4, 5] as const;
export const REAR_PANEL = 6;
export const LMU_REAR_DENT = 4;
export const DETACHED_SEVERITY = 3;

export type BodyDamageTier = 'ok' | 'light' | 'heavy' | 'detached';
export type SuspDamageTier =
  'ok' | 'light' | 'medium' | 'heavy' | 'totaled' | 'detached';

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
  if (severity >= DETACHED_SEVERITY) return 'detached';
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

export const tyreWearTier = (wear: number | undefined): SuspDamageTier => {
  if (wear === undefined || !Number.isFinite(wear)) return 'ok';
  if (wear <= PUNCTURE_WEAR) return 'detached';
  if (wear < 0.2) return 'heavy';
  if (wear < 0.5) return 'medium';
  if (wear < 0.8) return 'light';
  return 'ok';
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

export const integrityFraction = (
  aeroDamage: number | undefined,
  dentSeverity: readonly number[]
): number | null => aeroIntegrity(aeroDamage) ?? bodyIntegrity(dentSeverity);

export const suspensionIntegrity = (
  suspensionDamage: readonly number[],
  wheelDetached: readonly boolean[]
): number | null => {
  if (wheelDetached.some(Boolean)) return 0;
  const valid = suspensionDamage.filter((v) => Number.isFinite(v) && v >= 0);
  if (valid.length > 0) {
    return Math.max(0, Math.min(1, 1 - Math.max(...valid)));
  }
  return null;
};

export const tyreIntegrity = (
  tyreWear: readonly number[],
  lost: readonly boolean[] = []
): number | null => {
  if (lost.some(Boolean)) return 0;
  const valid = tyreWear.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return Math.max(0, Math.min(1, Math.min(...valid)));
};

export const isPunctured = (
  wear: number | undefined,
  pressure?: number
): boolean =>
  (wear !== undefined && Number.isFinite(wear) && wear <= PUNCTURE_WEAR) ||
  (pressure !== undefined &&
    Number.isFinite(pressure) &&
    pressure <= PUNCTURE_PRESSURE_KPA);

export const formatIntegrityPct = (value: number | null): string => {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
};

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
  tyrePressure: number[];
  aeroDamage: number | undefined;
  repairTime: number | undefined;
  optRepairTime: number | undefined;
  repairNeeded: boolean;
  optRepairNeeded: boolean;
  bodyDetached: boolean;
}

export const lmuDents = (data: DamageSnapshot): readonly number[] =>
  data.bodyDetached && data.dentSeverity.length === 8
    ? data.dentSeverity.map((severity, slot) =>
        slot === LMU_REAR_DENT ? DETACHED_SEVERITY : severity
      )
    : data.dentSeverity;

export const hasCarDamage = (data: DamageSnapshot): boolean => {
  if (data.repairNeeded || data.optRepairNeeded) return true;
  if (data.bodyDetached) return true;
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
  const corners = Math.max(data.tyreWear.length, data.tyrePressure.length);
  for (let index = 0; index < corners; index += 1) {
    if (isPunctured(data.tyreWear[index], data.tyrePressure[index])) {
      return true;
    }
  }
  return false;
};

export const DEMO_DAMAGE: DamageSnapshot = {
  dentSeverity: [0, 1, 0, 0, 1, 0, 0, 2],
  wheelDetached: [false, false, false, false],
  suspensionDamage: [0.01, 0.2, 0.05, 0.5],
  tyreWear: [0.92, 0.88, 0.005, 0.75],
  tyrePressure: [172, 171, 169, 170],
  aeroDamage: 0.18,
  repairTime: 12.5,
  optRepairTime: 4.0,
  repairNeeded: true,
  optRepairNeeded: true,
  bodyDetached: false,
};

export const getDemoDamage = (elapsedSec = 0): DamageSnapshot => {
  const repairCycle = 20;
  const optCycle = 8;
  const repairTime = Math.max(
    0,
    repairCycle - (elapsedSec % (repairCycle + 2))
  );
  const optRepairTime = Math.max(0, optCycle - (elapsedSec % (optCycle + 2)));
  return {
    ...DEMO_DAMAGE,
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
  tyrePressure: [],
  aeroDamage: 0,
  repairTime: undefined,
  optRepairTime: undefined,
  repairNeeded: false,
  optRepairNeeded: false,
  bodyDetached: false,
};
