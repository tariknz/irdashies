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
  ok: '#52525b',
  light: '#facc15',
  heavy: '#ef4444',
  detached: '#27272a',
};

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
  if (severity >= DETACHED_SEVERITY) return 'detached';
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

export const panelIntegrity = (severity: number): number => {
  if (!Number.isFinite(severity) || severity <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - Math.min(severity, 2) / 2));
};

export const panelsIntegrity = (
  severities: readonly number[]
): number | null => {
  if (severities.length === 0) return null;
  const total = severities.reduce(
    (sum, severity) => sum + (1 - panelIntegrity(severity)),
    0
  );
  return Math.max(0, 1 - total / severities.length);
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

export const formatDamagedPct = (value: number | null): string | null => {
  if (value === null || value >= 0.995) return null;
  return formatIntegrityPct(value);
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
  engineWarnings?: number;
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

const DEMO_DAMAGE_BASE: DamageSnapshot = {
  dentSeverity: [1, 0, 2, 0, 0, 0, 1, 0],
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
  engineWarnings: 0x01,
};

export const DEMO_DAMAGE: DamageSnapshot = DEMO_DAMAGE_BASE;

const DEMO_WARNING_CYCLE = [0x01, 0x04, 0x40, 0x02, 0x08, 0] as const;

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
    tyrePressure: [172, 171, 169, 170],
    aeroDamage: 0.05 + 0.35 * wave(1, 16),
    repairTime,
    optRepairTime,
    repairNeeded: repairTime > 0,
    optRepairNeeded: optRepairTime > 0,
    bodyDetached: false,
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
  tyrePressure: [],
  aeroDamage: 0,
  repairTime: undefined,
  optRepairTime: undefined,
  repairNeeded: false,
  optRepairNeeded: false,
  bodyDetached: false,
  engineWarnings: 0,
};
