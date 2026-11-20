import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  useCarConditionSnapshot,
  useCarDynamicsSnapshot,
  useDashboard,
  useDriverControlsSnapshot,
  useFuelProjectionSnapshot,
  useSessionBarSnapshot,
  useSessionVisibility,
  useTrackLength,
  useTrackStateSelector,
  useTrackStateSnapshot,
  trackStateSelectors,
} from '@irdashies/context';
import type {
  AccelerationTimerConfig,
  CompactTelemetryWidgetConfig,
  CruiseOdometerConfig,
  StintHistoryConfig,
  WidgetConfigMap,
} from '@irdashies/types';
import {
  groupStints,
  IDLE_ACCELERATION_TIMER,
  integrateDistance,
  mapGForce,
  runningTime,
  updateAccelerationTimer,
  type AccelerationTimerState,
} from './logic';

const emptyVisibility = {
  race: true,
  loneQualify: true,
  openQualify: true,
  practice: true,
  offlineTesting: true,
};

function useSettings<K extends keyof WidgetConfigMap>(id: K) {
  const { currentDashboard } = useDashboard();
  return currentDashboard?.widgets.find(
    (widget) => (widget.type || widget.id) === id
  )?.config as WidgetConfigMap[K] | undefined;
}

function MetricFrame({
  config,
  title,
  children,
}: {
  config?: CompactTelemetryWidgetConfig;
  title: string;
  children: ReactNode;
}) {
  const isOnTrack = useTrackStateSelector(trackStateSelectors.isOnTrack);
  const visible = useSessionVisibility(
    config?.sessionVisibility ?? emptyVisibility
  );
  if (!visible || (config?.showOnlyWhenOnTrack && !isOnTrack)) return null;
  return (
    <div
      className="h-full w-full overflow-hidden rounded border border-slate-600/60 p-2 text-slate-100"
      style={{
        backgroundColor: `rgb(15 23 42 / ${(config?.background.opacity ?? 80) / 100})`,
      }}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      {children}
    </div>
  );
}

const timerText = (
  timer: AccelerationTimerState | undefined,
  now: number | undefined
) => {
  if (timer?.elapsed != null) return `${timer.elapsed.toFixed(2)} s`;
  const running = timer ? runningTime(timer, now) : null;
  return running === null ? '—' : `${running.toFixed(2)} s`;
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
};

export function AccelerationTimer() {
  const config = useSettings('accelerationtimer') as
    AccelerationTimerConfig | undefined;
  const dynamics = useCarDynamicsSnapshot();
  const gear = useDriverControlsSnapshot()?.gear;
  const speed = dynamics?.speed;
  const now = dynamics?.sessionTime;
  const ranges = useMemo(() => config?.ranges ?? [], [config?.ranges]);
  const [timers, setTimers] = useState<AccelerationTimerState[]>([]);
  useEffect(() => {
    if (speed === undefined || now === undefined) return;
    setTimers((current) =>
      ranges.map((range, index) =>
        updateAccelerationTimer(
          current[index] ?? IDLE_ACCELERATION_TIMER,
          range,
          speed * 3.6,
          now,
          gear ?? 0
        )
      )
    );
  }, [gear, now, ranges, speed]);
  return (
    <MetricFrame config={config} title="Acceleration">
      <div className="space-y-1">
        {ranges.map((range, index) => (
          <div
            className="flex justify-between"
            key={`${range.fromKph}-${range.toKph}`}
          >
            <span className="text-slate-400">
              {range.fromKph}–{range.toKph} km/h
            </span>
            <span className="font-mono font-semibold">
              {timerText(timers[index], now)}
            </span>
          </div>
        ))}
      </div>
    </MetricFrame>
  );
}

export function StintHistory() {
  const config = useSettings('stinthistory') as StintHistoryConfig | undefined;
  const fuel = useFuelProjectionSnapshot();
  const stints = useMemo(
    () =>
      groupStints(fuel?.completedLaps ?? []).slice(-(config?.maxStints ?? 3)),
    [config?.maxStints, fuel?.completedLaps]
  );
  return (
    <MetricFrame config={config} title="Stint history">
      <div className="space-y-1 text-xs">
        {stints.length === 0 && (
          <div className="text-slate-500">No completed stint</div>
        )}
        {stints.map((stint) => (
          <div
            className="grid grid-cols-5 gap-2"
            key={`${stint.firstLap}-${stint.lastLap}`}
          >
            <span>
              L{stint.firstLap}–{stint.lastLap}
            </span>
            <span>{formatTime(stint.duration)}</span>
            <span>{stint.fuelUsed.toFixed(1)} L</span>
            <span>{formatTime(stint.averageLap)}</span>
            <span>±{stint.consistency.toFixed(2)} s</span>
          </div>
        ))}
      </div>
    </MetricFrame>
  );
}

export function FrictionCircle() {
  const config = useSettings('frictioncircle');
  const car = useCarDynamicsSnapshot();
  const g = mapGForce(car?.lateralAccel, car?.longitudinalAccel);
  const [peakBrake, setPeakBrake] = useState(0);
  useEffect(() => {
    const longitudinal = g.longitudinal;
    setPeakBrake((peak) =>
      longitudinal === null ? 0 : Math.max(peak, -longitudinal)
    );
  }, [g.longitudinal]);
  const x = Math.max(-2, Math.min(2, g.lateral ?? 0));
  const y = Math.max(-2, Math.min(2, g.longitudinal ?? 0));
  return (
    <MetricFrame
      config={config}
      title={`G force · brake ${peakBrake.toFixed(2)} g`}
    >
      <div className="relative mx-auto aspect-square h-[calc(100%-18px)] max-w-full rounded-full border border-slate-500">
        <div className="absolute left-1/2 top-0 h-full border-l border-slate-600" />
        <div className="absolute left-0 top-1/2 w-full border-t border-slate-600" />
        {g.lateral !== null && g.longitudinal !== null && (
          <div
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400"
            style={{ left: `${50 + x * 25}%`, top: `${50 - y * 25}%` }}
          />
        )}
      </div>
    </MetricFrame>
  );
}

const corners = ['LF', 'RF', 'LR', 'RR'];

function FourCorners({
  values,
  transform = (value) => value,
  suffix,
}: {
  values?: readonly (number | null)[];
  transform?: (value: number) => number;
  suffix: string;
}) {
  return (
    <div className="grid h-[calc(100%-18px)] grid-cols-2 gap-2">
      {corners.map((corner, index) => (
        <div className="rounded bg-slate-800/70 p-1 text-center" key={corner}>
          <div className="text-[10px] text-slate-500">{corner}</div>
          <div className="font-mono font-semibold">
            {Number.isFinite(values?.[index])
              ? `${transform(values?.[index] as number).toFixed(1)}${suffix}`
              : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BrakePressure() {
  const config = useSettings('brakepressure');
  const car = useCarDynamicsSnapshot();
  return (
    <MetricFrame config={config} title="Brake pressure">
      <FourCorners values={car?.brakeLinePressure} suffix="" />
    </MetricFrame>
  );
}

export function SuspensionPosition() {
  const config = useSettings('suspensionposition');
  const car = useCarDynamicsSnapshot();
  return (
    <MetricFrame config={config} title="Suspension">
      <FourCorners
        values={car?.suspensionDeflection}
        transform={(value) => value * 1000}
        suffix=" mm"
      />
    </MetricFrame>
  );
}

export function TrackClock() {
  const config = useSettings('trackclock');
  const snapshot = useSessionBarSnapshot();
  const seconds = snapshot?.sessionTimeOfDay ?? null;
  const clock =
    seconds === null
      ? '—'
      : `${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;
  return (
    <MetricFrame config={config} title="Track clock">
      <div className="text-center font-mono text-2xl font-bold">{clock}</div>
    </MetricFrame>
  );
}

export function SteeringMeter() {
  const config = useSettings('steeringmeter');
  const controls = useDriverControlsSnapshot();
  const car = useCarConditionSnapshot();
  const angle =
    controls?.steeringWheelAngle === undefined
      ? undefined
      : -controls.steeringWheelAngle;
  const max = car?.steeringWheelAngleMax;
  const ratio =
    Number.isFinite(angle) && Number.isFinite(max) && max
      ? Math.max(-1, Math.min(1, (angle as number) / (max as number)))
      : null;
  return (
    <MetricFrame config={config} title="Steering">
      <div className="relative mt-4 h-3 rounded bg-slate-700">
        <div className="absolute left-1/2 h-full border-l border-white" />
        {ratio !== null && (
          <div
            className="absolute top-[-4px] h-5 w-1 bg-cyan-400"
            style={{ left: `${50 + ratio * 50}%` }}
          />
        )}
      </div>
      <div className="mt-2 text-center font-mono">
        {angle === undefined ? '—' : `${((angle * 180) / Math.PI).toFixed(0)}°`}
        <span className="ml-2 text-slate-500">
          /{max === undefined ? '—' : `${((max * 180) / Math.PI).toFixed(0)}°`}
        </span>
      </div>
    </MetricFrame>
  );
}

export function CruiseOdometer() {
  const config = useSettings('cruiseodometer') as
    CruiseOdometerConfig | undefined;
  const track = useTrackStateSnapshot();
  const trackLength = useTrackLength();
  const [odometer, setOdometer] = useState(0);
  const previousTime = useRef<number | null>(null);
  useEffect(() => {
    if (!track) return;
    const previous = previousTime.current;
    if (previous !== null) {
      setOdometer((value) =>
        integrateDistance(value, track.speed, track.sessionTime - previous)
      );
    }
    previousTime.current = track.sessionTime;
  }, [track]);
  const position =
    !track || !Number.isFinite(trackLength) || trackLength <= 0
      ? null
      : track.lapDistPct * trackLength;
  const divisor = config?.distanceUnit === 'mi' ? 1609.344 : 1000;
  const unit = config?.distanceUnit ?? 'km';
  return (
    <MetricFrame config={config} title="Cruise / odometer">
      <div className="grid grid-cols-2 text-center">
        <div>
          <div className="text-xs text-slate-500">Track</div>
          <div className="font-mono text-lg">
            {position === null ? '—' : (position / divisor).toFixed(2)} {unit}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Trip</div>
          <div className="font-mono text-lg">
            {(odometer / divisor).toFixed(2)} {unit}
          </div>
        </div>
      </div>
    </MetricFrame>
  );
}
