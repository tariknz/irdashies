import { usePitlaneHelperSettings } from './hooks/usePitlaneHelperSettings';
import { usePitSpeed } from './hooks/usePitSpeed';
import { usePitboxPosition } from './hooks/usePitboxPosition';
import { usePitlaneVisibility } from './hooks/usePitlaneVisibility';
import { usePitLimiterWarning } from './hooks/usePitLimiterWarning';
import { usePitlaneTraffic } from './hooks/usePitlaneTraffic';
import { useTelemetryValue, useDashboard } from '@irdashies/context';
import {
  getDemoPitlaneData,
  PitlaneHelperSettings,
  PitSpeedResult,
  PitboxPositionResult,
  PitLimiterWarningResult,
  PitlaneTrafficResult,
} from './demoData';
import { PitCountdownBar } from './components/PitCountdownBar';
import { PitExitInputs } from './components/PitExitInputs';
import { PitSpeedBar } from './components/PitSpeedBar';

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
  const position = usePitboxPosition(
    config.approachDistance,
    config.earlyPitboxThreshold
  );
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
    config.enableEarlyPitboxWarning && onPitRoad && position.isEarlyPitbox;

  // Determine if we should show the pit exit inputs based on distance
  const atPitbox = Math.abs(position.distanceToPit) < 10;
  const afterPitbox = position.distanceToPit < -10;
  const shouldShowInputs =
    config.showPitExitInputs &&
    onPitRoad &&
    (config.showInputsPhase === 'always' ||
      (config.showInputsPhase === 'atPitbox' && atPitbox) ||
      (config.showInputsPhase === 'afterPitbox' && afterPitbox));

  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded text-white font-medium"
      style={{
        backgroundColor: `rgb(30 41 59 / ${config.background.opacity}%)`,
      }}
    >
      {/* Main row: speed delta text + all bars side by side */}
      <div className="flex items-end gap-2">
        {/* Speed delta text */}
        <div
          className={[
            'flex flex-col justify-center px-1.5 py-1 rounded transition-all min-w-0',
            speed.isSeverelyOver
              ? 'bg-red-600 animate-pulse'
              : speed.isSpeeding
                ? 'bg-red-600/50'
                : '',
          ].join(' ')}
        >
          <div
            className={[
              'text-xl font-bold leading-none transition-colors tabular-nums',
              speed.isSeverelyOver || speed.isSpeeding
                ? 'text-white'
                : speed.colorClass,
            ].join(' ')}
          >
            {speed.deltaKph > 0 ? '+' : ''}
            {displayKph ? speed.deltaKph.toFixed(1) : speed.deltaMph.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-400 leading-none mt-0.5">
            {displayKph ? 'km/h' : 'mph'}
          </div>
          <div
            className={[
              'text-[10px] leading-none mt-0.5',
              speed.isSpeeding ? 'text-white/70' : 'text-slate-500',
            ].join(' ')}
          >
            lim{' '}
            {displayKph ? speed.limitKph.toFixed(0) : speed.limitMph.toFixed(0)}
          </div>
        </div>

        {/* Speed bar */}
        {config.showSpeedBar && (
          <PitSpeedBar speedKph={speed.speedKph} limitKph={speed.limitKph} />
        )}

        {/* Pit Entry bar (when approaching) */}
        {!onPitRoad &&
          position.distanceToPitEntry > 0 &&
          position.distanceToPitEntry <= config.approachDistance && (
            <PitCountdownBar
              distance={position.distanceToPitEntry}
              maxDistance={config.approachDistance}
              orientation="vertical"
              color={getCountdownColor(
                position.distanceToPitEntry,
                config.approachDistance
              )}
              targetName="entry"
            />
          )}

        {/* Pitbox bar (when on pit road) */}
        {onPitRoad && Math.abs(position.distanceToPit) >= 5 && (
          <PitCountdownBar
            distance={Math.abs(position.distanceToPit)}
            maxDistance={100}
            orientation="vertical"
            color={
              position.distanceToPit > 0
                ? getCountdownColor(position.distanceToPit, 100)
                : 'rgb(34, 197, 94)'
            }
            targetName={position.distanceToPit > 0 ? 'box' : 'past'}
          />
        )}

        {/* Pit exit bar */}
        {onPitRoad &&
          position.distanceToPit < -5 &&
          position.distanceToPitExit > 0 &&
          position.distanceToPitExit <= 150 && (
            <PitCountdownBar
              distance={position.distanceToPitExit}
              maxDistance={150}
              orientation="vertical"
              color={getCountdownColor(position.distanceToPitExit, 150)}
              targetName="exit"
            />
          )}

        {/* Input bars (clutch/throttle) */}
        {shouldShowInputs && (
          <PitExitInputs
            showThrottle={config.pitExitInputs.throttle}
            showClutch={config.pitExitInputs.clutch}
          />
        )}
      </div>

      {/* Status badges */}
      {onPitRoad && Math.abs(position.distanceToPit) < 5 && (
        <div className="text-center text-xs font-bold py-0.5 px-2 bg-green-600 rounded">
          At Pitbox
        </div>
      )}

      {inBlendZone && position.distanceToPitEntry === 0 && (
        <div className="text-center text-xs font-bold py-0.5 px-2 bg-amber-600 rounded">
          Entering Pit Lane
        </div>
      )}

      {limiterWarning.showWarning && (
        <div
          className={[
            'text-center text-xs font-bold py-0.5 px-2 rounded',
            limiterWarning.isTeamRaceWarning
              ? 'bg-red-700 animate-pulse'
              : 'bg-red-600',
          ].join(' ')}
        >
          {limiterWarning.warningText}
        </div>
      )}

      {showEarlyPitboxWarning && (
        <div className="bg-amber-600 text-center text-xs font-bold py-0.5 px-2 rounded">
          EARLY PITBOX
        </div>
      )}

      {config.showPitlaneTraffic && traffic.totalCars > 0 && (
        <div className="bg-blue-700 text-center text-xs py-0.5 px-2 rounded">
          {traffic.carsAhead} ahead · {traffic.carsBehind} behind
        </div>
      )}
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
    config.enableEarlyPitboxWarning && onPitRoad && position.isEarlyPitbox;

  // Determine if we should show the pit exit inputs based on distance
  const atPitbox = Math.abs(position.distanceToPit) < 10;
  const afterPitbox = position.distanceToPit < -10;
  const shouldShowInputs =
    config.showPitExitInputs &&
    onPitRoad &&
    (config.showInputsPhase === 'always' ||
      (config.showInputsPhase === 'atPitbox' && atPitbox) ||
      (config.showInputsPhase === 'afterPitbox' && afterPitbox));

  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded text-white font-medium"
      style={{
        backgroundColor: `rgb(30 41 59 / ${config.background.opacity}%)`,
      }}
    >
      {/* Main row: speed delta text + all bars side by side */}
      <div className="flex items-end gap-2">
        {/* Speed delta text */}
        <div
          className={[
            'flex flex-col justify-center px-1.5 py-1 rounded transition-all min-w-0',
            speed.isSeverelyOver
              ? 'bg-red-600 animate-pulse'
              : speed.isSpeeding
                ? 'bg-red-600/50'
                : '',
          ].join(' ')}
        >
          <div
            className={[
              'text-xl font-bold leading-none transition-colors tabular-nums',
              speed.isSeverelyOver || speed.isSpeeding
                ? 'text-white'
                : speed.colorClass,
            ].join(' ')}
          >
            {speed.deltaKph > 0 ? '+' : ''}
            {displayKph ? speed.deltaKph.toFixed(1) : speed.deltaMph.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-400 leading-none mt-0.5">
            {displayKph ? 'km/h' : 'mph'}
          </div>
          <div
            className={[
              'text-[10px] leading-none mt-0.5',
              speed.isSpeeding ? 'text-white/70' : 'text-slate-500',
            ].join(' ')}
          >
            lim{' '}
            {displayKph ? speed.limitKph.toFixed(0) : speed.limitMph.toFixed(0)}
          </div>
        </div>

        {/* Speed bar */}
        {config.showSpeedBar && (
          <PitSpeedBar speedKph={speed.speedKph} limitKph={speed.limitKph} />
        )}

        {/* Pit Entry bar (when approaching) */}
        {!onPitRoad &&
          position.distanceToPitEntry > 0 &&
          position.distanceToPitEntry <= config.approachDistance && (
            <PitCountdownBar
              distance={position.distanceToPitEntry}
              maxDistance={config.approachDistance}
              orientation="vertical"
              color={getCountdownColor(
                position.distanceToPitEntry,
                config.approachDistance
              )}
              targetName="entry"
            />
          )}

        {/* Pitbox bar (when on pit road) */}
        {onPitRoad && Math.abs(position.distanceToPit) >= 5 && (
          <PitCountdownBar
            distance={Math.abs(position.distanceToPit)}
            maxDistance={100}
            orientation="vertical"
            color={
              position.distanceToPit > 0
                ? getCountdownColor(position.distanceToPit, 100)
                : 'rgb(34, 197, 94)'
            }
            targetName={position.distanceToPit > 0 ? 'box' : 'past'}
          />
        )}

        {/* Pit exit bar */}
        {onPitRoad &&
          position.distanceToPit < -5 &&
          position.distanceToPitExit > 0 &&
          position.distanceToPitExit <= 150 && (
            <PitCountdownBar
              distance={position.distanceToPitExit}
              maxDistance={150}
              orientation="vertical"
              color={getCountdownColor(position.distanceToPitExit, 150)}
              targetName="exit"
            />
          )}

        {/* Input bars (clutch/throttle) */}
        {shouldShowInputs && (
          <PitExitInputs
            showThrottle={config.pitExitInputs.throttle}
            showClutch={config.pitExitInputs.clutch}
          />
        )}
      </div>

      {/* Status badges */}
      {onPitRoad && Math.abs(position.distanceToPit) < 5 && (
        <div className="text-center text-xs font-bold py-0.5 px-2 bg-green-600 rounded">
          At Pitbox
        </div>
      )}

      {limiterWarning.showWarning && (
        <div
          className={[
            'text-center text-xs font-bold py-0.5 px-2 rounded',
            limiterWarning.isTeamRaceWarning
              ? 'bg-red-700 animate-pulse'
              : 'bg-red-600',
          ].join(' ')}
        >
          {limiterWarning.warningText}
        </div>
      )}

      {showEarlyPitboxWarning && (
        <div className="bg-amber-600 text-center text-xs font-bold py-0.5 px-2 rounded">
          EARLY PITBOX
        </div>
      )}

      {config.showPitlaneTraffic && traffic.totalCars > 0 && (
        <div className="bg-blue-700 text-center text-xs py-0.5 px-2 rounded">
          {traffic.carsAhead} ahead · {traffic.carsBehind} behind
        </div>
      )}
    </div>
  );
};
