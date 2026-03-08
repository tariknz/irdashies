import { usePitlaneHelperSettings } from './hooks/usePitlaneHelperSettings';
import { usePitSpeed } from './hooks/usePitSpeed';
import { usePitboxPosition } from './hooks/usePitboxPosition';
import { usePitlaneVisibility } from './hooks/usePitlaneVisibility';
import { usePitLimiterWarning } from './hooks/usePitLimiterWarning';
import { usePitlaneTraffic } from './hooks/usePitlaneTraffic';
import { useTelemetryValue, useDashboard, useSessionVisibility } from '@irdashies/context';
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

  const isSessionVisible = useSessionVisibility(
    config?.sessionVisibility
  );

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
  if (!isVisible || !isSessionVisible) {
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
      <PitlaneHelperBody
        speed={speed}
        position={position}
        config={config}
        displayKph={displayKph}
        onPitRoad={onPitRoad}
        inBlendZone={inBlendZone}
        limiterWarning={limiterWarning}
        shouldShowInputs={shouldShowInputs}
        showEarlyPitboxWarning={showEarlyPitboxWarning}
        traffic={traffic}
      />
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
  const showEarlyPitboxWarning = config.enableEarlyPitboxWarning; // always show for demo

  // Toggle for demo
  const demnoLimiter = {
    showWarning: config.enablePitLimiterWarning,
    warningText: limiterWarning.warningText,
    isTeamRaceWarning: limiterWarning.isTeamRaceWarning,
  }

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
      <PitlaneHelperBody
        speed={speed}
        position={position}
        config={config}
        displayKph={displayKph}
        onPitRoad={onPitRoad}
        inBlendZone={false}
        limiterWarning={demnoLimiter}
        shouldShowInputs={shouldShowInputs}
        showEarlyPitboxWarning={showEarlyPitboxWarning}
        traffic={traffic}
      />
  );
};

// Shared inner content used by both runtime and demo displays
interface PitlaneHelperBodyProps {
  speed: PitSpeedResult;
  position: PitboxPositionResult;
  config: PitlaneHelperSettings;
  displayKph: boolean;
  onPitRoad: boolean;
  inBlendZone: boolean;
  limiterWarning: PitLimiterWarningResult;
  shouldShowInputs: boolean;
  showEarlyPitboxWarning: boolean;
  traffic: PitlaneTrafficResult;
}

export const PitlaneHelperBody = ({
  speed,
  position,
  config,
  displayKph,
  onPitRoad,
  inBlendZone,
  limiterWarning,
  shouldShowInputs,
  showEarlyPitboxWarning,
  traffic,
}: PitlaneHelperBodyProps) => {
  return (
    <>
    <div
      className="flex h-full flex-col gap-2 p-2 text-white font-medium rounded bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${config.background.opacity ?? 0}%`,
      }}
    >
      {/* Row 1: Speed delta + speed bar */}
      {config.showSpeedSummary && (
        <div
          className={[
            'flex gap-2 w-full h-full flex-1',
            config.speedBarOrientation == 'vertical'
              ? 'flex-row'
              : 'flex-col',
          ].join(' ')}
        >
          <div
            className={[
              'flex flex-col flex-2 items-center justify-center p-2 rounded transition-all text-center w-full h-full ',
              speed.isSeverelyOver
                ? 'bg-red-600 animate-pulse'
                : speed.isSpeeding
                  ? 'bg-red-600/50'
                  : '',
            ].join(' ')}
          >
            <div
              className={[
                'text-3xl font-bold leading-none transition-colors tabular-nums',
                speed.isSeverelyOver || speed.isSpeeding
                  ? 'text-white'
                  : speed.colorClass,
              ].join(' ')}
            >
              <div className="text-[1.4em]">
                {speed.deltaKph > 0 ? '+' : ''}
                {displayKph
                  ? speed.deltaKph.toFixed(1)
                  : speed.deltaMph.toFixed(1)}
              </div>
            </div>
            <div className="text-xs text-slate-400">
              {displayKph ? 'km/h' : 'mph'}
            </div>
            {config.speedLimitStyle === 'european' && (
              <div className="text-3xl font-bold text-slate-800 mt-2 w-[2.5em] h-[2.5em] bg-white border-3 border-red-500 rounded-full flex items-center justify-center">
                <div className="-translate-y-[0.05em] text-[1.4em]">
                  {displayKph
                    ? speed.limitKph.toFixed(0)
                    : speed.limitMph.toFixed(0)}
                </div>
              </div>
            )}
            {config.speedLimitStyle === 'american' && (
              <div className="font-bold text-3xl text-slate-800 mt-2 w-[2.5em] h-[2.5em] bg-white border-3 border-black rounded-lg flex flex-col items-center justify-center">
                <div className="text-[0.6em] font-semibold tracking-tight leading-none">LIMIT</div>
                <div className="text-[1.25em]">
                  {displayKph
                    ? speed.limitKph.toFixed(0)
                    : speed.limitMph.toFixed(0)}
                </div>
              </div>
            )}
          </div>

          {config.showSpeedBar && config.speedBarOrientation == 'vertical' && (
            <div className="flex gap-3 w-full h-full flex-1">
              <PitSpeedBar
                speedKph={speed.speedKph}
                limitKph={speed.limitKph}
                orientation={config.speedBarOrientation}
              />
            </div>
          )}
        </div>
      )}

      {config.showSpeedBar &&
        (!config.showSpeedSummary ||
          config.speedBarOrientation == 'horizontal') && (
          <div
            className={`flex gap-3 w-full h-full ${
              config.speedBarOrientation === 'vertical' ? 'flex-2' : 'flex-1'
            }`}
          >
            <PitSpeedBar
              speedKph={speed.speedKph}
              limitKph={speed.limitKph}
              orientation={config.speedBarOrientation}
            />
          </div>
        )}

      {/* Row 2: Countdown bars (entry/box/exit) */}
      {config.showProgressBar && (
        <div
          className={`flex flex-col gap-3 w-full ${
            config.progressBarOrientation === 'vertical' ? 'flex-2' : 'flex-1'
          }`}
        >
          {!onPitRoad &&
            position.distanceToPitEntry > 0 &&
            position.distanceToPitEntry <= config.approachDistance && (
              <PitCountdownBar
                distance={position.distanceToPitEntry}
                maxDistance={config.approachDistance}
                orientation={config.progressBarOrientation}
                color={getCountdownColor(
                  position.distanceToPitEntry,
                  config.approachDistance
                )}
                targetName="Pit Entry"
              />
            )}

          {onPitRoad &&
            (position.distanceToPit >= 5 ||
              (config.showPastPitBox && position.distanceToPit <= -5)) && (
              <PitCountdownBar
                distance={Math.abs(position.distanceToPit)}
                maxDistance={100}
                orientation={config.progressBarOrientation}
                color={
                  position.distanceToPit > 0
                    ? getCountdownColor(position.distanceToPit, 100)
                    : 'rgb(34, 197, 94)'
                }
                targetName={position.distanceToPit > 0 ? 'Pitbox' : 'Past Box'}
              />
            )}

          {onPitRoad &&
            position.distanceToPit < -5 &&
            position.distanceToPitExit > 0 &&
            position.distanceToPitExit <= 150 && (
              <PitCountdownBar
                distance={position.distanceToPitExit}
                maxDistance={150}
                orientation={config.progressBarOrientation}
                color={getCountdownColor(position.distanceToPitExit, 150)}
                targetName="Pit Exit"
              />
            )}
        </div>
      )}

      {/* Row 3: Inputs */}
      {config.showPitExitInputs && (
        <div className="flex gap-3 w-full flex-2">
          {shouldShowInputs && (
            <PitExitInputs
              showThrottle={config.pitExitInputs.throttle}
              showClutch={config.pitExitInputs.clutch}
            />
          )}
        </div>
      )}
      </div>

      {/* Status & warning badges */}
      <div className="flex flex-col gap-2 p-2 rounded bg-slate-800/(--bg-opacity)" 
      style={{
        ['--bg-opacity' as string]: `${config.background.opacity ?? 0}%`,
      }}>
        {onPitRoad && Math.abs(position.distanceToPit) < 5 && (
          <div className="text-center text-xs font-bold py-1 px-2 bg-green-600 rounded">
            At Pitbox
          </div>
        )}

        {inBlendZone && position.distanceToPitEntry === 0 && (
          <div className="text-center text-xs font-bold py-1 px-2 bg-amber-600 rounded">
            Entering Pit Lane
          </div>
        )}

        {limiterWarning.showWarning && (
          <div
            className={[
              'text-center text-xs font-bold py-1 px-2 rounded',
              limiterWarning.isTeamRaceWarning
                ? 'bg-red-700 animate-pulse'
                : 'bg-red-600',
            ].join(' ')}
          >
            {limiterWarning.warningText}
          </div>
        )}

        {showEarlyPitboxWarning && (
          <div className="bg-amber-600 text-center text-xs font-bold py-1 px-2 rounded">
            EARLY PITBOX
          </div>
        )}

        {config.showPitlaneTraffic && traffic.totalCars > 0 && (
          <div className="bg-blue-700 text-center text-xs py-1 px-2 rounded">
            {traffic.carsAhead} ahead · {traffic.carsBehind} behind
          </div>
        )}
      </div>

   </>
  );
};
