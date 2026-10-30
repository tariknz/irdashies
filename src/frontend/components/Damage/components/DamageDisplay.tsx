import type { DamageBodyStyle } from '../bodyStyle';
import type { DamageSnapshot } from '../logic';
import {
  BODY_FILL,
  SUSP_FILL,
  aeroIntegrity,
  bodyIntegrity,
  bodyTier,
  formatIntegrityPct,
  integrityFraction,
  iracingBodyTier,
  isPunctured,
  suspTier,
  suspensionIntegrity,
  tyreIntegrity,
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

export const DamageDisplay = ({
  data,
  opacity,
  showIntegrity,
  showStats,
  bodyStyle = 'gt',
  carLabel,
}: DamageDisplayProps) => {
  const hasDents = data.dentSeverity.length === 8;
  const dents = hasDents
    ? data.dentSeverity
    : Array.from({ length: 8 }, () => 0);
  const fallbackTier = iracingBodyTier(
    data.repairNeeded,
    data.optRepairNeeded
  );
  const panelFill = Array.from({ length: 8 }, (_, index) =>
    BODY_FILL[hasDents ? bodyTier(dents[index]) : fallbackTier]
  );

  const centre = integrityFraction(data.aeroDamage, hasDents ? dents : []);
  const aero = aeroIntegrity(data.aeroDamage);
  const body = bodyIntegrity(hasDents ? dents : []);
  const susp = suspensionIntegrity(data.suspensionDamage, data.wheelDetached);
  const tyre = tyreIntegrity(data.tyreWear);
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
      className="flex h-full w-full flex-col gap-1 overflow-hidden rounded-sm p-2 text-slate-100 bg-slate-800/(--bg-opacity)"
      style={{ ['--bg-opacity' as string]: `${opacity}%` }}
    >
      {carLabel ? (
        <div className="truncate text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {carLabel}
        </div>
      ) : null}
      <div className="relative mx-auto w-full max-w-[140px] flex-1 min-h-0">
        <CarSilhouette
          style={bodyStyle}
          panelFill={panelFill}
          wheelFill={wheelFill}
          punctured={punctured}
          integrityLabel={
            showIntegrity ? formatIntegrityPct(centre) : null
          }
        />
      </div>

      {showStats && (
        <div className="flex shrink-0 flex-col gap-0.5">
          <IntegrityRow label="Aero" value={aero} warnAt={0.5} />
          <IntegrityRow label="Body" value={body} warnAt={0.5} />
          <IntegrityRow label="Susp" value={susp} warnAt={0.7} />
          <IntegrityRow label="Tyre" value={tyre} warnAt={0.2} />
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
          {!hasDents && (data.repairNeeded || data.optRepairNeeded) && (
            <div className="text-center text-[10px] text-amber-400">
              {data.repairNeeded ? 'Repair needed' : 'Optional repair'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
