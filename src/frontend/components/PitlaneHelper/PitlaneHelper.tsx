import { usePitlaneHelperSettings } from './hooks/usePitlaneHelperSettings';
import { usePitSpeed } from './hooks/usePitSpeed';
import { usePitboxPosition } from './hooks/usePitboxPosition';
import { usePitlaneVisibility } from './hooks/usePitlaneVisibility';
import { usePitLimiterWarning } from './hooks/usePitLimiterWarning';
import { usePitlaneTraffic } from './hooks/usePitlaneTraffic';
import { useTelemetryValue, useDashboard } from '@irdashies/context';
import { getDemoPitlaneData, PitlaneHelperSettings, PitSpeedResult, PitboxPositionResult, PitLimiterWarningResult, PitlaneTrafficResult } from './demoData';
import { PitCountdownBar } from './components/PitCountdownBar';
import { PitExitInputs } from './components/PitExitInputs';

// Calculate color for countdown bars based on distance
const getCountdownColor = (distance: number, maxDistance: number): string => {
  const percent = (distance / maxDistance) * 100;
  if (percent > 50) return 'rgb(34, 197, 94)'; // green-500 - Far
  if (percent > 25) return 'rgb(234, 179, 8)'; // yellow-500 - Medium
  return 'rgb(59, 130, 246)'; // blue-500 - Close
};

export const PitlaneHelper = () => {
  const { isDemoMode } = useDashboard();
  const config = usePitlaneHelperSettings();
  const surface = (useTelemetryValue('PlayerTrackSurface') ?? 3) as number;
  const onPitRoadTelemetry = useTelemetryValue<boolean>('OnPitRoad') ?? false;

  // Core data hooks - must be called in same order every render
  const speed = usePitSpeed();
  const position = usePitboxPosition(config.approachDistance, config.earlyPitboxThreshold);
  const isVisible = usePitlaneVisibility();
  const limiterWarning = usePitLimiterWarning(config.enablePitLimiterWarning);
  const traffic = usePitlaneTraffic(config.showPitlaneTraffic);

  // Generate demo data when in demo mode
  if (isDemoMode) {
    const demoData = getDemoPitlaneData();
    return <PitlaneHelperDisplay {...demoData} config={config} />;
  }

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Determine which speed unit to display (prefer user's unit from limit)
  const displayKph = speed.limitKph > speed.limitMph;

  // Determine if we're on pit road
  // Surface=2 means in pit blend zone (before pit entry line)
  // OnPitRoad=true means past the pit entry line (actually on pit road)
  const inBlendZone = surface === 2 && !onPitRoadTelemetry;
  const onPitRoad = onPitRoadTelemetry;

  // Early pitbox warning: show when on pit road AND pitbox is within threshold of pit entry
  // This alerts the driver once committed to pitting that their pitbox is very close to entry
  // Examples: Daytona where first pitbox is ~30m past pit entry
  // The warning appears when surface=2 (OnPitRoad) and pitbox is within the configured threshold
  const showEarlyPitboxWarning =
    config.enableEarlyPitboxWarning &&
    onPitRoad &&
    position.isEarlyPitbox;

  // Determine if we should show the pit exit inputs based on distance
  const atPitbox = Math.abs(position.distanceToPit) < 10;
  const afterPitbox = position.distanceToPit < -10;
  const shouldShowInputs = config.showPitExitInputs && onPitRoad && (
    config.showInputsPhase === 'always' ||
    (config.showInputsPhase === 'atPitbox' && atPitbox) ||
    (config.showInputsPhase === 'afterPitbox' && afterPitbox)
  );

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded text-white font-medium"
      style={{
        backgroundColor: `rgb(30 41 59 / ${config.background.opacity}%)`,
        minWidth: '150px',
      }}
    >
      {/* Speed Delta */}
      <div
        className={[
          'flex flex-col items-center p-2 rounded transition-all',
          speed.isSeverelyOver
            ? 'bg-red-600 animate-pulse'
            : speed.isSpeeding
              ? 'bg-red-600/50'
              : '',
        ].join(' ')}
      >
        <div
          className={[
            'text-2xl font-bold transition-colors',
            speed.isSeverelyOver || speed.isSpeeding ? 'text-white' : speed.colorClass,
          ].join(' ')}
        >
          {speed.deltaKph > 0 ? '+' : ''}
          {displayKph ? speed.deltaKph.toFixed(1) : speed.deltaMph.toFixed(1)}{' '}
          {displayKph ? 'km/h' : 'mph'}
        </div>
        <div className={speed.isSpeeding ? 'text-xs text-white/80' : 'text-xs text-slate-400'}>
          Limit: {displayKph ? speed.limitKph.toFixed(0) : speed.limitMph.toFixed(0)}{' '}
          {displayKph ? 'km/h' : 'mph'}
        </div>
      </div>

      {/* Countdown Bars Container - displays bars side by side */}
      <div className="flex gap-2">
        {/* Pit Entry Countdown (when approaching or in blend zone) */}
        {!onPitRoad && position.distanceToPitEntry > 0 && position.distanceToPitEntry <= config.approachDistance && (
          <div className="flex-1">
            <PitCountdownBar
              distance={position.distanceToPitEntry}
              maxDistance={config.approachDistance}
              orientation={config.progressBarOrientation}
              color={getCountdownColor(position.distanceToPitEntry, config.approachDistance)}
              targetName="Pit Entry"
            />
          </div>
        )}

        {/* Blend Zone Message (Surface=2 but OnPitRoad still false, no pit entry detection available) */}
        {inBlendZone && position.distanceToPitEntry === 0 && (
          <div className="flex-1 text-center text-sm font-bold py-2 px-3 bg-amber-600 rounded">
            Entering Pit Lane
          </div>
        )}

        {/* Pitbox Distance Display (when on pit road) */}
        {onPitRoad && (
          <div className="flex-1">
            {Math.abs(position.distanceToPit) < 5 ? (
              /* At Pitbox - Static Display */
              <div className="text-center text-sm font-bold py-2 px-3 bg-green-600 rounded">
                At Pitbox
              </div>
            ) : (
              /* Countdown to or past pitbox */
              <PitCountdownBar
                distance={Math.abs(position.distanceToPit)}
                maxDistance={100}
                orientation={config.progressBarOrientation}
                color={
                  position.distanceToPit > 0
                    ? getCountdownColor(position.distanceToPit, 100)  // Approaching pitbox
                    : 'rgb(34, 197, 94)'  // Past pitbox (green)
                }
                targetName={position.distanceToPit > 0 ? 'Pitbox' : 'Past Pitbox'}
              />
            )}
          </div>
        )}

        {/* Pit Exit Countdown (when on pit road and past pitbox) */}
        {onPitRoad && position.distanceToPit < -5 && position.distanceToPitExit > 0 && position.distanceToPitExit <= 150 && (
          <div className="flex-1">
            <PitCountdownBar
              distance={position.distanceToPitExit}
              maxDistance={150}
              orientation={config.progressBarOrientation}
              color={getCountdownColor(position.distanceToPitExit, 150)}
              targetName="Pit Exit"
            />
          </div>
        )}
      </div>

      {/* Pit Exit Inputs (throttle/clutch assistance) */}
      {shouldShowInputs && (
        <PitExitInputs
          showThrottle={config.pitExitInputs.throttle}
          showClutch={config.pitExitInputs.clutch}
        />
      )}

      {/* Warnings */}
      <div className="flex flex-col gap-1">
        {/* Pit Limiter Warning (CRITICAL - team race takes priority) */}
        {limiterWarning.showWarning && (
          <div
            className={[
              'text-center text-sm font-bold py-1 px-2 rounded',
              limiterWarning.isTeamRaceWarning
                ? 'bg-red-700 animate-pulse'
                : 'bg-red-600',
            ].join(' ')}
          >
            {limiterWarning.warningText}
          </div>
        )}

        {/* Early Pitbox Warning */}
        {showEarlyPitboxWarning && (
          <div className="bg-amber-600 text-center text-sm font-bold py-1 px-2 rounded">
            ⚠ EARLY PITBOX
          </div>
        )}

        {/* Traffic Display */}
        {config.showPitlaneTraffic && traffic.totalCars > 0 && (
          <div className="bg-blue-700 text-center text-xs py-1 px-2 rounded">
            {traffic.carsAhead} ahead • {traffic.carsBehind} behind
          </div>
        )}
      </div>
    </div>
  );
};



// Display component for demo data
interface PitlaneHelperDisplayProps {
  speed: PitSpeedResult;
  position: PitboxPositionResult;
  isVisible: boolean;
  limiterWarning: PitLimiterWarningResult;
  traffic: PitlaneTrafficResult;
  surface: number;
  config: PitlaneHelperSettings;
}

const PitlaneHelperDisplay = ({
  speed,
  position,
  isVisible,
  limiterWarning,
  traffic,
  surface,
  config,
}: PitlaneHelperDisplayProps) => {
  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Determine which speed unit to display (prefer user's unit from limit)
  const displayKph = speed.limitKph > speed.limitMph;

  // Early pitbox warning: show when on pit road AND pitbox is within threshold of pit entry
  const onPitRoad = surface === 2;
  const showEarlyPitboxWarning =
    config.enableEarlyPitboxWarning &&
    onPitRoad &&
    position.isEarlyPitbox;

  // Determine if we should show the pit exit inputs based on distance
  const atPitbox = Math.abs(position.distanceToPit) < 10;
  const afterPitbox = position.distanceToPit < -10;
  const shouldShowInputs = config.showPitExitInputs && onPitRoad && (
    config.showInputsPhase === 'always' ||
    (config.showInputsPhase === 'atPitbox' && atPitbox) ||
    (config.showInputsPhase === 'afterPitbox' && afterPitbox)
  );

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded text-white font-medium"
      style={{
        backgroundColor: `rgb(30 41 59 / ${config.background.opacity}%)`,
        minWidth: '150px',
      }}
    >
      {/* Speed Delta */}
      <div
        className={[
          'flex flex-col items-center p-2 rounded transition-all',
          speed.isSeverelyOver
            ? 'bg-red-600 animate-pulse'
            : speed.isSpeeding
              ? 'bg-red-600/50'
              : '',
        ].join(' ')}
      >
        <div
          className={[
            'text-2xl font-bold transition-colors',
            speed.isSeverelyOver || speed.isSpeeding ? 'text-white' : speed.colorClass,
          ].join(' ')}
        >
          {speed.deltaKph > 0 ? '+' : ''}
          {displayKph ? speed.deltaKph.toFixed(1) : speed.deltaMph.toFixed(1)}{' '}
          {displayKph ? 'km/h' : 'mph'}
        </div>
        <div className={speed.isSpeeding ? 'text-xs text-white/80' : 'text-xs text-slate-400'}>
          Limit: {displayKph ? speed.limitKph.toFixed(0) : speed.limitMph.toFixed(0)}{' '}
          {displayKph ? 'km/h' : 'mph'}
        </div>
      </div>

      {/* Pit Entry Countdown (when approaching but not yet on pit road) */}
      {!onPitRoad && position.distanceToPitEntry > 0 && position.distanceToPitEntry <= config.approachDistance && (
        <PitCountdownBar
          distance={position.distanceToPitEntry}
          maxDistance={config.approachDistance}
          orientation={config.progressBarOrientation}
          color={getCountdownColor(position.distanceToPitEntry, config.approachDistance)}
          targetName="Pit Entry"
        />
      )}

      {/* Pitbox Distance Display (when on pit road) */}
      {onPitRoad && (
        <>
          {Math.abs(position.distanceToPit) < 5 ? (
            /* At Pitbox - Static Display */
            <div className="text-center text-sm font-bold py-2 px-3 bg-green-600 rounded">
              At Pitbox
            </div>
          ) : (
            /* Countdown to or past pitbox */
            <PitCountdownBar
              distance={Math.abs(position.distanceToPit)}
              maxDistance={100}
              orientation={config.progressBarOrientation}
              color={
                position.distanceToPit > 0
                  ? getCountdownColor(position.distanceToPit, 100)  // Approaching pitbox
                  : 'rgb(34, 197, 94)'  // Past pitbox (green)
              }
              targetName={position.distanceToPit > 0 ? 'Pitbox' : 'Past Pitbox'}
            />
          )}
        </>
      )}

      {/* Pit Exit Countdown (when on pit road and past pitbox) */}
      {onPitRoad && position.distanceToPit < -5 && position.distanceToPitExit > 0 && position.distanceToPitExit <= 150 && (
        <PitCountdownBar
          distance={position.distanceToPitExit}
          maxDistance={150}
          orientation={config.progressBarOrientation}
          color={getCountdownColor(position.distanceToPitExit, 150)}
          targetName="Pit Exit"
        />
      )}

      {/* Pit Exit Inputs (throttle/clutch assistance) */}
      {shouldShowInputs && (
        <PitExitInputs
          showThrottle={config.pitExitInputs.throttle}
          showClutch={config.pitExitInputs.clutch}
        />
      )}

      {/* Warnings */}
      <div className="flex flex-col gap-1">
        {/* Pit Limiter Warning (CRITICAL - team race takes priority) */}
        {limiterWarning.showWarning && (
          <div
            className={[
              'text-center text-sm font-bold py-1 px-2 rounded',
              limiterWarning.isTeamRaceWarning
                ? 'bg-red-700 animate-pulse'
                : 'bg-red-600',
            ].join(' ')}
          >
            {limiterWarning.warningText}
          </div>
        )}

        {/* Early Pitbox Warning */}
        {showEarlyPitboxWarning && (
          <div className="bg-amber-600 text-center text-sm font-bold py-1 px-2 rounded">
            ⚠ EARLY PITBOX
          </div>
        )}

        {/* Traffic Display */}
        {config.showPitlaneTraffic && traffic.totalCars > 0 && (
          <div className="bg-blue-700 text-center text-xs py-1 px-2 rounded">
            {traffic.carsAhead} ahead • {traffic.carsBehind} behind
          </div>
        )}
      </div>
    </div>
  );
};
