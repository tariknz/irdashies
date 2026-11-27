import {
  DropIcon,
  EngineIcon,
  GasPumpIcon,
  ThermometerSimpleIcon,
} from '@phosphor-icons/react';
import { EngineWarnings } from '@irdashies/types';
import type { DamageBodyStyle } from '../bodyStyle';
import type { DamageSnapshot } from '../logic';
import {
  BODY_FILL,
  CORNER_LABELS,
  CORNER_OK_BG,
  SUSP_FILL,
  aeroIntegrity,
  bodyIntegrity,
  bodyTier,
  cornerIntegrity,
  formatDamagedPct,
  formatIntegrityPct,
  iracingBodyTier,
  isPunctured,
  LMU_DENT_PANELS,
  lmuDents,
  REAR_PANEL,
  panelsIntegrity,
  suspTier,
  suspensionIntegrity,
  tyreIntegrity,
  tyreWearTier,
  worstBodyTier,
} from '../logic';
import { CarSilhouette, type DamageAreaLabels } from './CarSilhouette';

export interface DamageDisplayProps {
  data: DamageSnapshot;
  opacity: number;
  showIntegrity: boolean;
  showStats: boolean;
  bodyStyle?: DamageBodyStyle;
}

function IntegrityRow({
  label,
  value,
  warnAt,
}: {
  label: string;
  value: number | null;
  warnAt: number;
}) {
  if (value === null) return null;
  const warn = value <= warnAt;
  return (
    <div className="flex items-center gap-1 text-[10px] leading-tight">
      <span className="w-8 shrink-0 text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-slate-700">
        <div
          className={`h-full ${warn ? 'bg-red-500' : 'bg-slate-300'}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span
        className={`w-8 shrink-0 text-right font-mono ${warn ? 'text-red-400' : 'text-slate-100'}`}
      >
        {formatIntegrityPct(value)}
      </span>
    </div>
  );
}

function StatusIcons({ warnings }: { warnings: number }) {
  const oil =
    !!(warnings & EngineWarnings.OilPressureWarning) ||
    !!(warnings & EngineWarnings.OilTempWarning);
  const water = !!(warnings & EngineWarnings.WaterTempWarning);
  const fuel = !!(warnings & EngineWarnings.FuelPressureWarning);
  const engine = !!(warnings & EngineWarnings.EngineStalled);

  const items = [
    { key: 'oil', Icon: DropIcon, active: oil, title: 'Oil' },
    { key: 'fuel', Icon: GasPumpIcon, active: fuel, title: 'Fuel pressure' },
    { key: 'engine', Icon: EngineIcon, active: engine, title: 'Engine' },
    {
      key: 'temp',
      Icon: ThermometerSimpleIcon,
      active: water,
      title: 'Water temp',
    },
  ] as const;

  return (
    <div className="flex shrink-0 flex-col gap-1 self-center">
      {items.map(({ key, Icon, active, title }) => (
        <div
          key={key}
          title={title}
          className={[
            'flex h-5 w-5 items-center justify-center rounded-sm border',
            active
              ? 'border-amber-400 bg-slate-900 text-amber-300'
              : 'border-slate-700 bg-slate-900/80 text-slate-600',
          ].join(' ')}
        >
          <Icon size={12} weight={active ? 'fill' : 'regular'} />
        </div>
      ))}
    </div>
  );
}

function cornerStyle(fill: string): {
  backgroundColor: string;
  className: string;
} {
  if (fill === SUSP_FILL.ok) {
    return { backgroundColor: CORNER_OK_BG, className: 'text-teal-300' };
  }
  if (fill === SUSP_FILL.detached) {
    return { backgroundColor: fill, className: 'text-slate-200' };
  }
  return { backgroundColor: fill, className: 'text-slate-950' };
}

export const DamageDisplay = ({
  data,
  opacity,
  showIntegrity,
  showStats,
  bodyStyle = 'gtMid',
}: DamageDisplayProps) => {
  const repairNeeded = data.repairNeeded || (data.repairTime ?? 0) > 0;
  const optRepairNeeded = data.optRepairNeeded || (data.optRepairTime ?? 0) > 0;
  const hasDents = data.dentSeverity.length === 8;
  const slots = lmuDents(data);
  const dents = hasDents
    ? LMU_DENT_PANELS.map((slot) => slots[slot])
    : Array.from({ length: 8 }, () => 0);
  const fallbackTier = iracingBodyTier(repairNeeded, optRepairNeeded);

  const frontTier = hasDents
    ? worstBodyTier(dents[0], dents[1], dents[2])
    : fallbackTier;
  const rightTier = hasDents
    ? worstBodyTier(dents[2], dents[4], dents[7])
    : fallbackTier;
  const rearTier = hasDents
    ? worstBodyTier(dents[5], dents[6], dents[7])
    : fallbackTier;
  const leftTier = hasDents
    ? worstBodyTier(dents[0], dents[3], dents[5])
    : fallbackTier;

  const bodyStroke: [string, string, string, string] = [
    BODY_FILL[frontTier],
    BODY_FILL[rightTier],
    BODY_FILL[rearTier],
    BODY_FILL[leftTier],
  ];
  const wingFill =
    BODY_FILL[hasDents ? bodyTier(dents[REAR_PANEL]) : fallbackTier];

  const hasSusp = data.suspensionDamage.some(
    (v) => Number.isFinite(v) && v >= 0
  );

  const wheelFill = [0, 1, 2, 3].map((index) => {
    if (data.wheelDetached[index]) return SUSP_FILL.detached;
    return SUSP_FILL[tyreWearTier(data.tyreWear[index])];
  });

  const suspFill = [0, 1, 2, 3].map((index) => {
    const detached = !!data.wheelDetached[index];
    if (hasSusp || detached) {
      return SUSP_FILL[suspTier(detached, data.suspensionDamage[index])];
    }
    if (isPunctured(data.tyreWear[index], data.tyrePressure?.[index]))
      return SUSP_FILL.detached;
    return BODY_FILL.ok;
  });

  const punctured = [0, 1, 2, 3].map(
    (index) =>
      isPunctured(data.tyreWear[index], data.tyrePressure?.[index]) &&
      !data.wheelDetached[index]
  );

  const labels: DamageAreaLabels = {};
  if (showIntegrity) {
    if (hasDents) {
      labels.front = formatDamagedPct(
        panelsIntegrity([dents[0], dents[1], dents[2]])
      );
      labels.right = formatDamagedPct(
        panelsIntegrity([dents[2], dents[4], dents[7]])
      );
      labels.rear = formatDamagedPct(
        panelsIntegrity([dents[5], dents[6], dents[7]])
      );
      labels.left = formatDamagedPct(
        panelsIntegrity([dents[0], dents[3], dents[5]])
      );
    }

    const cornerKeys = ['fl', 'fr', 'rl', 'rr'] as const;
    for (let index = 0; index < 4; index++) {
      labels[cornerKeys[index]] = formatDamagedPct(
        cornerIntegrity(
          !!data.wheelDetached[index],
          data.suspensionDamage[index],
          data.tyreWear[index],
          hasSusp || !!data.wheelDetached[index]
        )
      );
    }
  }

  return (
    <div
      className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-md p-2 text-slate-100 bg-slate-800/(--bg-opacity)"
      style={{ ['--bg-opacity' as string]: `${opacity}%` }}
    >
      <div className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-300">
        Vehicle Damage
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1">
          <CarSilhouette
            style={bodyStyle}
            bodyStroke={bodyStroke}
            wingFill={wingFill}
            wheelFill={wheelFill}
            suspFill={suspFill}
            labels={labels}
          />
        </div>
        <StatusIcons warnings={data.engineWarnings ?? 0} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1">
        {CORNER_LABELS.map((label, index) => {
          const badgeFill =
            hasSusp || data.wheelDetached[index]
              ? suspFill[index]
              : wheelFill[index];
          const style = cornerStyle(badgeFill);
          const hole = punctured[index];
          return (
            <div
              key={label}
              className={[
                'rounded-sm px-1 py-0.5 text-center text-[10px] font-bold tracking-wide',
                style.className,
                hole ? 'outline outline-1 outline-red-500' : '',
              ].join(' ')}
              style={{ backgroundColor: style.backgroundColor }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {showStats && (
        <div className="flex shrink-0 flex-col gap-0.5">
          <IntegrityRow
            label="Aero"
            value={aeroIntegrity(data.aeroDamage)}
            warnAt={0.5}
          />
          <IntegrityRow
            label="Body"
            value={bodyIntegrity(hasDents ? dents : [])}
            warnAt={0.5}
          />
          <IntegrityRow
            label="Susp"
            value={suspensionIntegrity(
              data.suspensionDamage,
              data.wheelDetached
            )}
            warnAt={0.7}
          />
          <IntegrityRow
            label="Tyre"
            value={tyreIntegrity(
              data.tyreWear,
              [0, 1, 2, 3].map(
                (index) => !!data.wheelDetached[index] || punctured[index]
              )
            )}
            warnAt={0.2}
          />
          {data.repairTime !== undefined && data.repairTime > 0 && (
            <div className="mt-0.5 text-center font-mono text-[10px] text-slate-400">
              Repair {data.repairTime.toFixed(1)}s
            </div>
          )}
          {data.optRepairTime !== undefined && data.optRepairTime > 0 && (
            <div className="text-center font-mono text-[10px] text-slate-500">
              Opt {data.optRepairTime.toFixed(1)}s
            </div>
          )}
          {!hasDents && (repairNeeded || optRepairNeeded) && (
            <div className="text-center text-[10px] text-amber-400">
              {repairNeeded ? 'Repair needed' : 'Optional repair'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
