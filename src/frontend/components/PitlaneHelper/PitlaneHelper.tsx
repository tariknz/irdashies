import { usePitlaneHelperSettings } from './hooks/usePitlaneHelperSettings';
import { usePitSpeed } from './hooks/usePitSpeed';
import { usePitboxPosition } from './hooks/usePitboxPosition';
import { usePitlaneVisibility } from './hooks/usePitlaneVisibility';
import { usePitLimiterWarning } from './hooks/usePitLimiterWarning';
import { usePitlaneTraffic } from './hooks/usePitlaneTraffic';
import { useTelemetryValue } from '@irdashies/context';

export const PitlaneHelper = () => {
  const config = usePitlaneHelperSettings();
  const surface = (useTelemetryValue('PlayerTrackSurface') ?? 3) as number;

  // Core data hooks
  const speed = usePitSpeed();
  const position = usePitboxPosition(config.approachDistance);
  const isVisible = usePitlaneVisibility();
  const limiterWarning = usePitLimiterWarning(config.enablePitLimiterWarning);
  const traffic = usePitlaneTraffic(config.showPitlaneTraffic);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Determine which speed unit to display (prefer user's unit from limit)
  const displayKph = speed.limitKph > speed.limitMph;

  // Early pitbox warning: show when on pit road (surface=2), pitbox is early (>90% track),
  // and we're within the threshold distance and haven't passed it yet
  const onPitRoad = surface === 2;
  const showEarlyPitboxWarning =
    config.enableEarlyPitboxWarning &&
    onPitRoad &&
    position.isEarlyPitbox &&
    position.distanceToPit > 0 &&
    position.distanceToPit <= config.earlyPitboxThreshold;

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

      {/* Position Display */}
      <div className="flex flex-col gap-1">
        <div className="text-center text-sm">
          {Math.abs(position.distanceToPit) < 5
            ? 'At pitbox'
            : position.distanceToPit > 0
              ? `${Math.abs(position.distanceToPit).toFixed(0)}m to pit`
              : `${Math.abs(position.distanceToPit).toFixed(0)}m past pit`}
        </div>
        {/* Progress bar */}
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all duration-300"
            style={{ width: `${position.progressPercent}%` }}
          />
        </div>
      </div>

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
