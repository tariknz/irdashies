import React from 'react';
import {
  useTelemetryValue,
  useSessionStore,
  useTotalRaceLaps,
} from '@irdashies/context';
import { useStore } from 'zustand';
import { fuelDisplayValue } from '../fuelCalculations';
import type { FuelCalculation, FuelCalculatorSettings } from '../types';

interface FuelCalculatorWidgetProps {
  fuelData: FuelCalculation | null;
  liveFuelData?: FuelCalculation | null;
  liveFuelLevel?: number;
  displayData: FuelCalculation | null | undefined;
  fuelUnits?: 'L' | 'gal';
  settings?: FuelCalculatorSettings;
  widgetId?: string;
  predictiveUsage?: number;
  customStyles?: {
    fontSize?: number;
    labelFontSize?: number;
    valueFontSize?: number;
    barFontSize?: number;
    height?: number;
  };
  compactMode?: 'off' | 'compact' | 'ultra';
}

export const FuelCalculatorConsumptionGrid: React.FC<
  FuelCalculatorWidgetProps
> = ({
  fuelData,
  displayData,
  fuelUnits = 'L',
  settings,
  widgetId,
  customStyles,
  compactMode,
  predictiveUsage,
  liveFuelData,
  liveFuelLevel,
}) => {
  // Check if we are in a testing/practice session
  // We need the current SessionNum to look up the SessionType in the SessionInfo array
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionFlags = useTelemetryValue('SessionFlags');

  const sessionType = useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (s) => s.SessionNum === sessionNum
      )?.SessionType
  );

  // Use shared hook for total race laps (handles timed races and leader lapping)
  const { totalRaceLaps } = useTotalRaceLaps();

  // Custom style handling for separate label/value sizes
  const widgetStyle =
    customStyles || (widgetId && settings?.widgetStyles?.[widgetId]) || {};

  const labelFontSize = widgetStyle.labelFontSize
    ? `${widgetStyle.labelFontSize}px`
    : widgetStyle.fontSize
      ? `${widgetStyle.fontSize}px`
      : '10px';
  const valueFontSize = widgetStyle.valueFontSize
    ? `${widgetStyle.valueFontSize}px`
    : widgetStyle.fontSize
      ? `${widgetStyle.fontSize}px`
      : '12px';

  // Container style for other props like padding/margins if needed, but font size is handled per element now
  const containerStyle: React.CSSProperties = {
    ...(customStyles ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((widgetId && settings?.widgetStyles?.[widgetId]) as any) ||
      {}),
  };

  // Check for "Offline Testing" or "Practice"
  const isTesting =
    sessionType === 'Offline Testing' || sessionType === 'Practice';
  const isRace = sessionType === 'Race';

  // Use frozen displayData directly - it is already snapshotted by the parent
  // We do NOT want live updates here.
  const lapsRemainingToUse = displayData?.lapsRemaining || 0;
  const currentLap = displayData?.currentLap || 0;
  const fuelLevelToUse = displayData?.fuelLevel ?? 0;
  // Check for White (0x0002) or Checkered (0x0004) flag
  const isFinalLapOrFinished =
    sessionFlags && (sessionFlags & 0x0002 || sessionFlags & 0x0004);

  // If final lap/finished, we clamp the total race laps to the current lap (so it shows X / X)
  let effectiveTotalLaps = Math.max(totalRaceLaps, currentLap);
  if (isFinalLapOrFinished) {
    effectiveTotalLaps = currentLap;
  }

  // Grid Data (Frozen Values from Parent)
  const avg = displayData?.avgLaps || displayData?.avg10Laps || 0;
  const max = displayData?.maxLapUsage || 0;
  const last = displayData?.lastLapUsage || 0;
  const min = displayData?.minLapUsage || 0;
  const qual = displayData?.maxQualify || 0;
  // Current usage can be live if wanted, but user asked to remove "Real Time Update"
  // so we use the frozen LAST lap usage or similar?
  // actually "CURR" usually means "Current Lap Projection".
  // The user said "remove real time update from consumption grid".
  // If we freeze "CURR", it will show 0 or the start of lap value?
  // Usually "CURR" in the grid implies the Projected usage for the *current* lap.
  // If we freeze it, it won't move.
  // Let's use the 'predictiveUsage' passed prop which might be throttled or frozen,
  // OR just use displayData?.projectedLapUsage if we want it frozen at lap start (which would be 0).
  // However, "CURR" row usually implies "What am I doing NOW".
  // If the user wants NO real time updates, then "CURR" might be misleading or should just be static "Last Lap"?
  // Re-reading request: "Quero remover a atualização em tempo real do consumption grid".
  // This likely means the "Refuel" / "At Finish" numbers shouldn't dance around.
  // Those numbers depend on Fuel Level and Laps Remaining.
  // If we freeze Fuel Level and Laps Remaining, the "Refuel/At Finish" columns will be stable.
  // The "CURR" *value* (the usage itself) might still want to be live?
  // Let's stick to using the `displayData` fully, which is frozen in parent 'frozenDisplayData'.
  // If parent logic freezes it, then `displayData.projectedLapUsage` will be frozen too.
  // Use frozen displayData for stable columns
  // BUT use predictiveUsage (passed from parent's throttled trigger) for the CURR column
  const currentUsage = predictiveUsage ?? displayData?.projectedLapUsage ?? 0;
  const tankCapacity = fuelData?.fuelTankCapacity ?? 0;

  // Calculate derivates (Laps, Refuel, Finish)
  const calcCol = (
    usage: number,
    contextTotalLaps: number,
    contextLapsRemaining: number,
    contextFuelLevel: number
  ) => {
    if (usage <= 0)
      return {
        laps: NaN,
        refuel: 0,
        totalReq: 0,
        isDeficit: false,
        fitsInTank: true,
        isValid: false,
        hideRefuel: true,
      };

    // Laps calculation
    const laps = contextFuelLevel / usage;

    // Total Required for Race (Distance * Usage)
    // We use contextTotalLaps which might be live or frozen depending on the row
    const totalReq = contextTotalLaps * usage;

    // Finish (Fuel at finish) -> This is effectively our BALANCE for coloring
    // Formula: CurrentFuel - FuelNeeded
    // FuelNeeded = LapsRemaining * Usage
    const fuelNeeded = contextLapsRemaining * usage;
    const balance = contextFuelLevel - fuelNeeded;

    // Fuel to add is the actionable pit-stop amount. A positive finish
    // balance means no refuel is required; a deficit becomes a positive add.
    const refuelValue = Math.max(0, -balance);
    const isDeficit = balance < 0;
    const fitsInTank = tankCapacity <= 0 || refuelValue <= tankCapacity;

    // If testing, hide Refuel and Finish (return 0/invalid)
    if (isTesting) {
      return {
        laps: laps,
        refuel: 0,
        totalReq: 0,
        isDeficit: false,
        fitsInTank: true,
        isValid: true,
        hideRefuel: true,
      };
    }

    return {
      laps: laps, // number
      refuel: refuelValue, // number (absolute value to show)
      totalReq: totalReq, // number
      isDeficit: isDeficit, // boolean
      fitsInTank,
      isValid: true,
      hideRefuel: false,
    };
  };

  // Frozen Context Data (for static rows)
  const frozenFuelLevel = fuelLevelToUse;
  const frozenLapsRemaining = lapsRemainingToUse;
  const frozenTotalLaps = effectiveTotalLaps; // Already based on displayData (frozen)

  // Live Context Data (for CURR row)
  // We prefer liveFuelData if available to get the most up-to-date 'lapsRemaining' and 'totalLaps'
  const liveTotalLaps = liveFuelData?.totalLaps ?? frozenTotalLaps;
  // If we are finished, clamp live remaining to 0 or appropriate
  const liveLapsRemaining = liveFuelData?.lapsRemaining ?? frozenLapsRemaining;
  const dataLiveFuelLevel = liveFuelLevel || frozenFuelLevel;

  // Header Logic: Usually headers should be stable too if the grid is stable,
  // but "Total Laps" changing is a major event.
  // The user requested removing update in middle of lap.
  // Let's keep the Header reflecting the FROZEN state effectively to match the grid rows?
  // Or should it be live? If I change race length, I likely want to see it up top.
  // But if the rows below (AVG/MAX) are calculating based on OLD length, then header showing NEW length is confusing.
  // Verdict: Header should match the rows context. Since most rows are frozen, Header uses frozenTotalLaps.

  const avgData = calcCol(
    avg,
    frozenTotalLaps,
    frozenLapsRemaining,
    frozenFuelLevel
  );
  const maxData = calcCol(
    max,
    frozenTotalLaps,
    frozenLapsRemaining,
    frozenFuelLevel
  );
  const avg10Data = calcCol(
    displayData?.avg10Laps || 0,
    frozenTotalLaps,
    frozenLapsRemaining,
    frozenFuelLevel
  );
  const lastData = calcCol(
    last,
    frozenTotalLaps,
    frozenLapsRemaining,
    frozenFuelLevel
  );
  const minData = calcCol(
    min,
    frozenTotalLaps,
    frozenLapsRemaining,
    frozenFuelLevel
  );
  const qualData = calcCol(
    qual,
    frozenTotalLaps,
    frozenLapsRemaining,
    frozenFuelLevel
  );

  // CURR uses LIVE context
  const currentData = calcCol(
    currentUsage,
    liveTotalLaps,
    liveLapsRemaining,
    dataLiveFuelLevel
  );
  if (!fuelData) return null;

  // Master visibility toggle
  if (settings && settings.showConsumption === false) return null;

  // Visibility Settings (Default to true if no settings provided, except Min which is optional in modern default layout)
  const showAvg = settings ? settings.show3LapAvg : true;
  const showAvg10 = settings ? settings.show10LapAvg : true;
  const showMax = settings ? settings.showMax : true;
  const showLast = settings ? settings.showLastLap : true;
  const showCurrent = settings ? settings.showCurrentLap : true;
  const showMin = settings ? settings.showMin : false; // Default off for compact modern layout unless enabled

  // Calculate derivates (Laps, Refuel, Finish) for each column
  // This duplicates some logic but ensures consistent display as per mockup

  // Helper for color coding Finish

  // Helper for formatting
  const fmt = (num: number, isValid: boolean) =>
    isValid ? num.toFixed(2) : '--';
  const fmtFuel = (liters: number, isValid = true) =>
    isValid ? fuelDisplayValue(liters, fuelUnits).toFixed(2) : '--';
  const formatFuelToAdd = (data: {
    refuel: number;
    isValid: boolean;
    hideRefuel?: boolean;
  }) => {
    if (!data.isValid || data.hideRefuel) return '--';
    return `+${fmtFuel(data.refuel)}`;
  };

  const getFuelToAddClass = (data: {
    fitsInTank: boolean;
    isValid: boolean;
  }) => {
    if (!data.isValid) return 'text-slate-300';
    return data.fitsInTank ? 'text-emerald-400' : 'text-red-400';
  };

  // Helper for Refuel color

  const rowPadding = compactMode === 'ultra' ? '' : 'px-1 py-px';
  const headerPadding =
    compactMode === 'ultra'
      ? 'px-1'
      : compactMode === 'compact'
        ? 'px-1 py-0.5'
        : 'px-1 py-1';
  const gridPadding =
    compactMode === 'ultra' ? '' : compactMode === 'compact' ? 'px-1' : 'px-2';
  const rowGap = '';
  const rowCls = 'col-span-4 grid grid-cols-subgrid';
  const recommendedRowCls = `${rowCls} bg-slate-700/50`;
  const actionCellCls = rowPadding;
  const avg10 = displayData?.avg10Laps || 0;
  const pitWindowOpen = displayData?.pitWindowOpen ?? 0;
  const pitWindowClose = displayData?.pitWindowClose ?? 0;
  const hasStrategy = isRace && avg > 0;
  const pitWindowStart = Math.ceil(pitWindowOpen);
  const pitWindowEnd = Math.floor(pitWindowClose);
  const pitWindowLabel = !hasStrategy
    ? '--'
    : pitWindowStart === pitWindowEnd
      ? `L${pitWindowStart}`
      : `L${pitWindowStart}–${pitWindowEnd}`;
  const isPitWindowOpen =
    hasStrategy && currentLap >= pitWindowStart && currentLap <= pitWindowEnd;
  const isPastPitWindow = hasStrategy && currentLap > pitWindowEnd;
  const pitWindowStatus = !hasStrategy
    ? 'PIT WINDOW'
    : isPastPitWindow
      ? 'PIT NOW'
      : isPitWindowOpen
        ? 'OPEN'
        : 'OPENS';
  const pitWindowStatusClass = isPastPitWindow
    ? 'text-red-400'
    : isPitWindowOpen
      ? 'text-emerald-400'
      : 'text-amber-300';

  return (
    <div
      style={containerStyle}
      className={`grid w-full grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] select-none overflow-hidden ${gridPadding} ${rowGap}`}
    >
      <div
        className="col-span-4 flex items-center justify-between pb-1 text-slate-500 font-semibold tracking-wide uppercase"
        style={{ fontSize: labelFontSize }}
      >
        <span>
          Race L{currentLap}
          {(displayData?.totalLaps ?? 0) > 0
            ? ` / ${displayData?.totalLaps.toFixed(0)}`
            : ''}
        </span>
        <span>Fuel {fmtFuel(frozenFuelLevel)}</span>
      </div>
      {/* Grid Header */}
      <div className="col-span-4 mt-0.5 grid grid-cols-subgrid bg-slate-900/30">
        <div aria-hidden="true" />
        <div
          className={`font-bold text-slate-400 flex justify-center items-center leading-none ${headerPadding}`}
          style={{ fontSize: labelFontSize }}
        >
          USE/LAP
        </div>
        <div
          className={`font-bold text-slate-400 flex justify-center items-center leading-none ${headerPadding}`}
          style={{ fontSize: labelFontSize }}
        >
          LAPS
        </div>
        <div
          className={`font-bold text-slate-400 flex justify-center items-center leading-none ${headerPadding}`}
          style={{ fontSize: labelFontSize }}
        >
          TO ADD
        </div>
      </div>

      {/* Dynamic Rows based on Order */}
      {(() => {
        const defaultOrder = [
          'curr',
          'avg',
          'max',
          'min',
          'last',
          'avg10',
          'qual',
        ];
        const savedOrder = settings?.consumptionGridOrder || defaultOrder;
        const order = [...savedOrder];

        const renderRow = (type: string) => {
          switch (type) {
            case 'curr':
              if (!showCurrent) return null;
              return (
                <div key="curr" className={rowCls}>
                  <div
                    className={`text-slate-400 ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    EST.
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {currentUsage > 0 ? fmtFuel(currentUsage) : '--'}
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(currentData.laps, isFinite(currentData.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(currentData)} text-center ${actionCellCls}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {formatFuelToAdd(currentData)}
                  </div>
                </div>
              );
            case 'avg': {
              if (!showAvg) return null;
              const avgLabel = `AVG ${settings?.avgLapsCount || 3}`;
              return (
                <div key="avg" className={recommendedRowCls}>
                  <div
                    className={`text-white font-semibold ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    {avgLabel}
                  </div>
                  <div
                    className={`text-white text-center ${rowPadding} font-bold`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmtFuel(avg)}
                  </div>
                  <div
                    className={`text-white text-center ${rowPadding} font-bold`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(avgData.laps, isFinite(avgData.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(avgData)} text-center ${actionCellCls} font-bold`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {formatFuelToAdd(avgData)}
                  </div>
                </div>
              );
            }
            case 'avg10':
              if (!showAvg10 || avg10 <= 0) return null;
              return (
                <div key="avg10" className={rowCls}>
                  <div
                    className={`text-slate-400 ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    AVG 10
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmtFuel(avg10)}
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(avg10Data.laps, isFinite(avg10Data.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(avg10Data)} text-center ${actionCellCls}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {formatFuelToAdd(avg10Data)}
                  </div>
                </div>
              );
            case 'max':
              if (!showMax) return null;
              return (
                <div key="max" className={rowCls}>
                  <div
                    className={`text-slate-400 ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    MAX
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmtFuel(max)}
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(maxData.laps, isFinite(maxData.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(maxData)} text-center ${actionCellCls}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {formatFuelToAdd(maxData)}
                  </div>
                </div>
              );
            case 'last':
              if (!showLast) return null;
              return (
                <div key="last" className={rowCls}>
                  <div
                    className={`text-slate-400 ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    LAST
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmtFuel(last)}
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(lastData.laps, isFinite(lastData.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(lastData)} text-center ${actionCellCls}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {formatFuelToAdd(lastData)}
                  </div>
                </div>
              );
            case 'min':
              if (!showMin) return null;
              return (
                <div key="min" className={rowCls}>
                  <div
                    className={`text-slate-400 ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    MIN
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmtFuel(min)}
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(minData.laps, isFinite(minData.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(minData)} text-center ${actionCellCls}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {formatFuelToAdd(minData)}
                  </div>
                </div>
              );
            case 'qual':
              if (settings?.showQualifyConsumption === false || qual <= 0)
                return null;
              return (
                <div key="qual" className={rowCls}>
                  <div
                    className={`text-slate-400 ${rowPadding}`}
                    style={{ fontSize: labelFontSize }}
                  >
                    QUAL
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {qual > 0 ? fmtFuel(qual) : '--'}
                  </div>
                  <div
                    className={`text-slate-300 text-center ${rowPadding}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {fmt(qualData.laps, isFinite(qualData.laps))}
                  </div>
                  <div
                    className={`${getFuelToAddClass(qualData)} text-center ${actionCellCls}`}
                    style={{ fontSize: valueFontSize }}
                  >
                    {isRace && qual > 0 ? formatFuelToAdd(qualData) : '--'}
                  </div>
                </div>
              );
            default:
              return null;
          }
        };

        const uniqueOrder = Array.from(new Set(order));
        return uniqueOrder.map((id) => renderRow(id));
      })()}
      <div className="col-span-4 mt-1 grid grid-cols-[1fr_auto] items-center bg-slate-900/30 px-1 py-1 tabular-nums">
        <div className="flex items-baseline gap-1">
          <span
            className={`font-bold tracking-wide ${pitWindowStatusClass}`}
            style={{ fontSize: valueFontSize }}
          >
            {pitWindowStatus}
          </span>
          <span
            className="font-bold text-white"
            style={{ fontSize: valueFontSize }}
          >
            {pitWindowLabel}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-semibold tracking-wide text-slate-500"
            style={{ fontSize: labelFontSize }}
          >
            ADD
          </span>
          <strong
            className={getFuelToAddClass(avgData)}
            style={{ fontSize: valueFontSize }}
          >
            {hasStrategy ? `+${fmtFuel(avgData.refuel)} ${fuelUnits}` : '--'}
          </strong>
        </div>
      </div>
    </div>
  );
};
