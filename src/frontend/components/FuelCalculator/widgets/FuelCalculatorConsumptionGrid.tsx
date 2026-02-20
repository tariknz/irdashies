import React, { memo } from 'react';
import type { FuelCalculatorWidgetProps } from '../types';

/* eslint-disable react/prop-types */

export const FuelCalculatorConsumptionGrid = memo<FuelCalculatorWidgetProps>(
  ({
    fuelData,
    displayData,
    settings,
    widgetId,
    customStyles,
    isCompact,
    predictiveUsage,
    liveFuelData,
    liveFuelLevel,
    sessionFlags,
    sessionType,
    totalRaceLaps = 0,
  }) => {
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

      // Logic for Refuel Column:
      // If Balance < 0 (Deficit): Show POSITIVE amount to ADD.
      // If Balance >= 0 (Surplus): Show POSITIVE amount EXTRA.
      const refuelValue = balance < 0 ? Math.abs(balance) : balance;
      const isDeficit = balance < 0;

      // If testing, hide Refuel and Finish (return 0/invalid)
      if (isTesting) {
        return {
          laps: laps,
          refuel: 0,
          totalReq: 0,
          isDeficit: false,
          isValid: true,
          hideRefuel: true,
        };
      }

      return {
        laps: laps, // number
        refuel: refuelValue, // number (absolute value to show)
        totalReq: totalReq, // number
        isDeficit: isDeficit, // boolean
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
    const liveLapsRemaining =
      liveFuelData?.lapsRemaining ?? frozenLapsRemaining;
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

    // Helper for Refuel color

    return (
      <div
        style={containerStyle}
        className={`grid grid-cols-5 ${isCompact ? 'gap-0 md:gap-x-0.5' : 'gap-0.5'} select-none overflow-hidden h-full content-start`}
      >
        {/* Grid Header */}
        <div
          className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'} flex flex-col justify-end leading-none`}
          style={{ fontSize: labelFontSize }}
        >
          <div style={{ fontSize: '0.8em', opacity: 0.7 }}>IN RACE</div>
          <div style={{ color: '#fff' }}>
            {currentLap}
            {isRace && effectiveTotalLaps > 0
              ? ` / ${effectiveTotalLaps.toFixed(2)}`
              : ''}
          </div>
        </div>
        <div
          className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`}
          style={{ fontSize: labelFontSize }}
        >
          USE
        </div>
        <div
          className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`}
          style={{ fontSize: labelFontSize }}
        >
          LAPS
        </div>
        <div
          className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`}
          style={{ fontSize: labelFontSize }}
        >
          REFUEL
        </div>
        <div
          className={`text-center font-bold text-slate-400 border-b border-slate-600/50 ${isCompact ? 'pb-0.5 mb-0.5' : 'pb-1 mb-1'}`}
          style={{ fontSize: labelFontSize }}
        >
          TOTAL
        </div>

        {/* Spacer for header bottom margin if needed (or handle via border/padding in cells) */}

        {/* Dynamic Rows based on Order */}
        {(() => {
          const defaultOrder = ['curr', 'avg', 'max', 'last', 'min', 'qual'];
          // Ensure all default keys are present in the final order, appended if missing (handles migration)
          const savedOrder = settings?.consumptionGridOrder || defaultOrder;
          const order = [...savedOrder];
          defaultOrder.forEach((key) => {
            if (!order.includes(key)) {
              order.push(key);
            }
          });

          const rowPadding = isCompact ? 'py-0' : 'py-0.5';

          const renderRow = (type: string) => {
            switch (type) {
              case 'curr':
                if (!showCurrent) return null;
                return (
                  <React.Fragment key="curr">
                    <div
                      className={`text-slate-400 ${rowPadding}`}
                      style={{ fontSize: labelFontSize }}
                    >
                      CURR
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding} font-bold`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {currentUsage > 0 ? currentUsage.toFixed(2) : '--'}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding} opacity-90`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(currentData.laps, isFinite(currentData.laps))}
                    </div>

                    <div
                      className={`${currentData.isDeficit ? 'text-red-500 bg-red-500/10' : 'text-green-400 bg-green-500/10'} text-center ${rowPadding} font-bold rounded mx-0.5`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {!currentData.isDeficit ? '+' : ''}
                      {fmt(currentData.refuel, true)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding} opacity-90`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(currentData.totalReq, true)}
                    </div>
                  </React.Fragment>
                );
              case 'avg': {
                if (!showAvg) return null;
                const avgLabel = `AVG ${settings?.avgLapsCount || 3}`;
                return (
                  <React.Fragment key="avg">
                    <div
                      className={`text-slate-400 ${rowPadding}`}
                      style={{ fontSize: labelFontSize }}
                    >
                      {avgLabel}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {avg.toFixed(2)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(avgData.laps, isFinite(avgData.laps))}
                    </div>

                    <div
                      className={`${avgData.isDeficit ? 'text-red-500 bg-red-500/10' : 'text-green-400 bg-green-500/10'} text-center ${rowPadding} font-bold rounded mx-0.5`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {!avgData.isDeficit ? '+' : ''}
                      {fmt(avgData.refuel, true)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(avgData.totalReq, true)}
                    </div>
                  </React.Fragment>
                );
              }
              case 'max':
                if (!showMax) return null;
                return (
                  <React.Fragment key="max">
                    <div
                      className={`text-slate-400 ${rowPadding}`}
                      style={{ fontSize: labelFontSize }}
                    >
                      MAX
                    </div>
                    <div
                      className={`text-orange-400 text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {max.toFixed(2)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(maxData.laps, isFinite(maxData.laps))}
                    </div>

                    <div
                      className={`${maxData.isDeficit ? 'text-red-500 bg-red-500/10' : 'text-green-400 bg-green-500/10'} text-center ${rowPadding} font-bold rounded mx-0.5`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {!maxData.isDeficit ? '+' : ''}
                      {fmt(maxData.refuel, true)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(maxData.totalReq, true)}
                    </div>
                  </React.Fragment>
                );
              case 'last':
                if (!showLast) return null;
                return (
                  <React.Fragment key="last">
                    <div
                      className={`text-slate-400 ${rowPadding}`}
                      style={{ fontSize: labelFontSize }}
                    >
                      LAST
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {last.toFixed(2)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(lastData.laps, isFinite(lastData.laps))}
                    </div>

                    <div
                      className={`${lastData.isDeficit ? 'text-red-500 bg-red-500/10' : 'text-green-400 bg-green-500/10'} text-center ${rowPadding} font-bold rounded mx-0.5`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {!lastData.isDeficit ? '+' : ''}
                      {fmt(lastData.refuel, true)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(lastData.totalReq, true)}
                    </div>
                  </React.Fragment>
                );
              case 'min':
                if (!showMin) return null;
                return (
                  <React.Fragment key="min">
                    <div
                      className={`text-slate-400 ${rowPadding}`}
                      style={{ fontSize: labelFontSize }}
                    >
                      MIN
                    </div>
                    <div
                      className={`text-green-400 text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {min.toFixed(2)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(minData.laps, isFinite(minData.laps))}
                    </div>

                    <div
                      className={`${minData.isDeficit ? 'text-red-500 bg-red-500/10' : 'text-green-400 bg-green-500/10'} text-center ${rowPadding} font-bold rounded mx-0.5`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {!minData.isDeficit ? '+' : ''}
                      {fmt(minData.refuel, true)}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(minData.totalReq, true)}
                    </div>
                  </React.Fragment>
                );
              case 'qual':
                // Only show if setting is enabled (defaulting to true if undefined for now, or false? Let's assume true for visibility unless toggled off)
                if (settings?.showQualifyConsumption === false) return null;

                return (
                  <React.Fragment key="qual">
                    <div
                      className={`text-slate-400 ${rowPadding}`}
                      style={{ fontSize: labelFontSize }}
                    >
                      QUAL MAX
                    </div>
                    <div
                      className={`text-orange-400 text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {qual > 0 ? qual.toFixed(2) : '--'}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {fmt(qualData.laps, isFinite(qualData.laps))}
                    </div>

                    <div
                      className={`${qualData.isDeficit ? 'text-red-500 bg-red-500/10' : 'text-green-400 bg-green-500/10'} text-center ${rowPadding} font-bold rounded mx-0.5`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {isRace && qual > 0 ? (
                        <>
                          {!qualData.isDeficit ? '+' : ''}
                          {fmt(qualData.refuel, true)}
                        </>
                      ) : (
                        '--'
                      )}
                    </div>
                    <div
                      className={`text-white text-center ${rowPadding}`}
                      style={{ fontSize: valueFontSize }}
                    >
                      {isRace && qual > 0 ? fmt(qualData.totalReq, true) : '--'}
                    </div>
                  </React.Fragment>
                );
              default:
                return null;
            }
          };

          // Filter unique valid IDs to avoid duplicates if config is messed up
          const uniqueOrder = Array.from(new Set(order));
          return uniqueOrder.map((id) => renderRow(id));
        })()}
      </div>
    );
  }
);

FuelCalculatorConsumptionGrid.displayName = 'FuelCalculatorConsumptionGrid';
