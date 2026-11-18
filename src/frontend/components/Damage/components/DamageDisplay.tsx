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
  bodyTier,
  formatIntegrityPct,
  integrityFraction,
  iracingBodyTier,
  isPunctured,
  suspTier,
  tyreWearTier,
} from '../logic';
import { CarSilhouette } from './CarSilhouette';

export interface DamageDisplayProps {
  data: DamageSnapshot;
  opacity: number;
  showIntegrity: boolean;
  showStats: boolean;
  bodyStyle?: DamageBodyStyle;
  carLabel?: string;
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
    return { backgroundColor: CORNER_OK_BG, className: 'text-[#39ff14]' };
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
  bodyStyle = 'gtMid',
}: DamageDisplayProps) => {
  const hasDents = data.dentSeverity.length === 8;
  const dents = hasDents
    ? data.dentSeverity
    : Array.from({ length: 8 }, () => 0);
  const fallbackTier = iracingBodyTier(data.repairNeeded, data.optRepairNeeded);
  const panelFill = Array.from(
    { length: 8 },
    (_, index) => BODY_FILL[hasDents ? bodyTier(dents[index]) : fallbackTier]
  );

  const centre =
    integrityFraction(data.aeroDamage, hasDents ? dents : []) ??
    (data.repairNeeded ? 0.5 : data.optRepairNeeded ? 0.75 : 1);
  const hasSusp = data.suspensionDamage.some(
    (v) => Number.isFinite(v) && v >= 0
  );

  const wheelFill = [0, 1, 2, 3].map((index) => {
    const detached = !!data.wheelDetached[index];
    if (hasSusp || detached) {
      return SUSP_FILL[suspTier(detached, data.suspensionDamage[index])];
    }
    return SUSP_FILL[tyreWearTier(data.tyreWear[index])];
  });
  const punctured = [0, 1, 2, 3].map(
    (index) => isPunctured(data.tyreWear[index]) && !data.wheelDetached[index]
  );

  return (
    <div
      className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-md p-2 text-slate-100 bg-slate-800/(--bg-opacity)"
      style={{ ['--bg-opacity' as string]: `${opacity}%` }}
    >
      <div className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-300">
        Vehicle Damage
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5">
        <div className="relative min-h-0 min-w-0 flex-1">
          <CarSilhouette
            style={bodyStyle}
            panelFill={panelFill}
            integrityLabel={showIntegrity ? formatIntegrityPct(centre) : null}
          />
        </div>
        <StatusIcons warnings={data.engineWarnings ?? 0} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1">
        {CORNER_LABELS.map((label, index) => {
          const style = cornerStyle(wheelFill[index]);
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
    </div>
  );
};
