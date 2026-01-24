

interface PitWindowWidgetProps {
  displayData: {
    pitWindowOpen: number;
    pitWindowClose: number;
    currentLap: number;
    canFinish: boolean;
  };
  fuelData: {
    lapsRemaining: number;
  } | null;
  showPitWindow: boolean;
  editMode?: boolean;
}

export const PitWindowWidget = ({
  displayData,
  fuelData,
  showPitWindow,
  editMode,
}: PitWindowWidgetProps) => {
  if (!showPitWindow) return null;
  // Always show widget if enabled (using placeholders/defaults if no data)
  // This prevents layout shifts/holes before first lap
  const safeLapsRemaining = fuelData?.lapsRemaining ?? 0;
  const safeOpen = displayData.pitWindowOpen || 0;
  const safeClose = displayData.pitWindowClose || 0;
  const safeCurrent = displayData.currentLap || 0;
  const hasData = !!fuelData;

  return (
    <div className="flex flex-col justify-center min-w-[100px] w-full py-1">
      <div className="text-[8px] text-slate-400 uppercase mb-0.5">
        Pit Window
      </div>
      <div className="h-3 bg-slate-900/80 rounded-full relative border border-slate-600/50 overflow-hidden w-full">
        <div
          className="absolute h-full bg-linear-to-r from-orange-500/30 to-orange-500/60 rounded-full"
          style={{
            left: `${((safeOpen - safeCurrent) / (safeLapsRemaining || 1)) * 100}%`,
            width: `${((safeClose - safeOpen) / (safeLapsRemaining || 1)) * 100}%`,
          }}
        />
        <div
          className="absolute w-0.5 h-full bg-green-400 shadow-[0_0_5px_rgba(0,255,0,0.8)]"
          style={{ left: '0%' }}
        />
      </div>
      <div className="text-[8px] text-slate-400 text-center mt-0.5">
        {!hasData 
           ? <span className="text-slate-600">--</span> 
           : displayData.canFinish
              ? 'No stop'
              : `L${safeOpen}-${safeClose.toFixed(1)}`
        }
      </div>
    </div>
  );
};

interface EnduranceStrategyWidgetProps {
  fuelData: {
    stopsRemaining?: number;
    lapsPerStint?: number;
    earliestPitLap?: number;
  } | null;
  displayData: {
    canFinish: boolean;
  };
  showEnduranceStrategy: boolean;
  editMode?: boolean;
}

export const EnduranceStrategyWidget = ({
  fuelData,
  displayData,
  showEnduranceStrategy,
  editMode,
}: EnduranceStrategyWidgetProps) => {
  if (!showEnduranceStrategy) return null;
  
  // Always show if enabled
  const hasData = fuelData && fuelData.stopsRemaining !== undefined && fuelData.lapsPerStint !== undefined;
  
  const stops = fuelData?.stopsRemaining ?? 0;
  const lps = fuelData?.lapsPerStint ?? 0;

  return (
    <div className="flex items-center gap-2 justify-around w-full py-1">
      <div className="flex flex-col items-center">
        <div className="text-[8px] text-slate-400 uppercase">Stops</div>
        <div className="text-xs font-semibold text-blue-400">
          {hasData ? stops : '--'}
        </div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-[8px] text-slate-400 uppercase">L/Stint</div>
        <div className="text-xs font-semibold text-blue-400">
          {hasData ? lps.toFixed(1) : '--'}
        </div>
      </div>
      {fuelData?.earliestPitLap !== undefined && !displayData.canFinish && (
        <div className="flex flex-col items-center">
          <div className="text-[8px] text-slate-400 uppercase">Early Pit</div>
          <div className="text-xs font-semibold text-cyan-400">
            L{fuelData?.earliestPitLap}
          </div>
        </div>
      )}
    </div>
  );
};
