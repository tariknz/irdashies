import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { shallow } from 'zustand/shallow';
import {
  useActiveSimulator,
  useChannelListener,
  useChannelSelector,
  useDashboard,
  useFuelProjectionSnapshot,
  useSessionBarSnapshot,
  useSessionVisibility,
  useTrackLength,
  useTrackStateSelector,
  trackStateSelectors,
} from '@irdashies/context';
import type {
  AccelerationTimerConfig,
  CarConditionSnapshot,
  CarDynamicsSnapshot,
  CompactTelemetryWidgetConfig,
  CruiseOdometerConfig,
  DriverControlsSnapshot,
  StintHistoryConfig,
  TrackStateSnapshot,
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

const selectGear = (snapshot: DriverControlsSnapshot) => snapshot.gear;

const selectCarDynamics = (snapshot: CarDynamicsSnapshot) => snapshot;

export function AccelerationTimer() {
  const config = useSettings('accelerationtimer') as
    AccelerationTimerConfig | undefined;
  const ranges = useMemo(
    () => (Array.isArray(config?.ranges) ? config.ranges : []),
    [config?.ranges]
  );
  const gear = useRef(0);
  const timers = useRef<AccelerationTimerState[]>([]);
  const [texts, setTexts] = useState<readonly string[]>([]);
  useChannelListener('driver-controls.snapshot', selectGear, (value) => {
    gear.current = value ?? 0;
  });
  useChannelListener(
    'car-dynamics.snapshot',
    selectCarDynamics,
    ({ speed, sessionTime }) => {
      if (speed !== undefined && sessionTime !== undefined) {
        timers.current = ranges.map((range, index) =>
          updateAccelerationTimer(
            timers.current[index] ?? IDLE_ACCELERATION_TIMER,
            range,
            speed * 3.6,
            sessionTime,
            gear.current
          )
        );
      }
      const next = ranges.map((_, index) =>
        timerText(timers.current[index], sessionTime)
      );
      if (!shallow(texts, next)) setTexts(next);
    }
  );
  return (
    <MetricFrame config={config} title="Acceleration">
      <div className="space-y-1">
        {ranges.map((range, index) => (
          <div className="flex justify-between" key={index}>
            <span className="text-slate-400">
              {range.fromKph}–{range.toKph} km/h
            </span>
            <span className="font-mono font-semibold">
              {texts[index] ?? '—'}
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
      groupStints(fuel?.completedLaps ?? []).slice(
        -Math.max(1, config?.maxStints ?? 3)
      ),
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

const selectAcceleration = (snapshot: CarDynamicsSnapshot) => ({
  lateralAccel: snapshot.lateralAccel,
  longitudinalAccel: snapshot.longitudinalAccel,
});

export function FrictionCircle() {
  const config = useSettings('frictioncircle');
  const acceleration = useChannelSelector(
    'car-dynamics.snapshot',
    selectAcceleration,
    { equality: shallow }
  );
  const sessionNum = useTrackStateSelector(trackStateSelectors.sessionNum);
  const g = mapGForce(
    acceleration?.lateralAccel,
    acceleration?.longitudinalAccel
  );
  const [peak, setPeak] = useState({ sessionNum, value: 0 });
  const peakBrake =
    g.longitudinal === null
      ? 0
      : Math.max(
          peak.sessionNum === sessionNum ? peak.value : 0,
          -g.longitudinal
        );
  if (peak.sessionNum !== sessionNum || peak.value !== peakBrake) {
    setPeak({ sessionNum, value: peakBrake });
  }
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
  digits = 1,
}: {
  values?: readonly (number | null)[];
  transform?: (value: number) => number;
  suffix: string;
  digits?: number;
}) {
  return (
    <div className="grid h-[calc(100%-18px)] grid-cols-2 gap-2">
      {corners.map((corner, index) => (
        <div className="rounded bg-slate-800/70 p-1 text-center" key={corner}>
          <div className="text-[10px] text-slate-500">{corner}</div>
          <div className="font-mono font-semibold">
            {Number.isFinite(values?.[index])
              ? `${transform(values?.[index] as number).toFixed(digits)}${suffix}`
              : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

const selectBrakeLinePressure = (snapshot: CarDynamicsSnapshot) =>
  snapshot.brakeLinePressure;

const toPercent = (fraction: number) => fraction * 100;

const selectSuspensionDeflection = (snapshot: CarDynamicsSnapshot) =>
  snapshot.suspensionDeflection;

export function BrakePressure() {
  const config = useSettings('brakepressure');
  const pressure = useChannelSelector(
    'car-dynamics.snapshot',
    selectBrakeLinePressure,
    { equality: shallow }
  );
  const isLmu = useActiveSimulator() === 'lmu';
  return (
    <MetricFrame config={config} title="Brake pressure">
      {isLmu ? (
        <FourCorners
          values={pressure}
          transform={toPercent}
          suffix="%"
          digits={0}
        />
      ) : (
        <FourCorners values={pressure} suffix="" />
      )}
    </MetricFrame>
  );
}

export function SuspensionPosition() {
  const config = useSettings('suspensionposition');
  const deflection = useChannelSelector(
    'car-dynamics.snapshot',
    selectSuspensionDeflection,
    { equality: shallow }
  );
  return (
    <MetricFrame config={config} title="Suspension">
      <FourCorners
        values={deflection}
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

const selectSteeringWheelAngle = (snapshot: DriverControlsSnapshot) =>
  snapshot.steeringWheelAngle;

const selectSteeringWheelAngleMax = (snapshot: CarConditionSnapshot) =>
  snapshot.steeringWheelAngleMax;

export function SteeringMeter() {
  const config = useSettings('steeringmeter');
  const wheelAngle = useChannelSelector(
    'driver-controls.snapshot',
    selectSteeringWheelAngle
  );
  const max = useChannelSelector(
    'car-condition.snapshot',
    selectSteeringWheelAngleMax
  );
  const angle = wheelAngle === undefined ? undefined : -wheelAngle;
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

const selectTrackState = (snapshot: TrackStateSnapshot) => snapshot;

const formatDistance = (meters: number, divisor: number) =>
  (meters / divisor).toFixed(2);

export function CruiseOdometer() {
  const config = useSettings('cruiseodometer') as
    CruiseOdometerConfig | undefined;
  const trackLength = useTrackLength();
  const divisor = config?.distanceUnit === 'mi' ? 1609.344 : 1000;
  const unit = config?.distanceUnit ?? 'km';
  const selectPosition = useCallback(
    (snapshot: TrackStateSnapshot) =>
      !Number.isFinite(trackLength) || trackLength <= 0
        ? null
        : formatDistance(snapshot.lapDistPct * trackLength, divisor),
    [divisor, trackLength]
  );
  const position = useTrackStateSelector(selectPosition);
  const [odometer, setOdometer] = useState(0);
  const distance = useRef(0);
  const previousTime = useRef<number | null>(null);
  useChannelListener(
    'track-state.snapshot',
    selectTrackState,
    ({ speed, sessionTime }) => {
      const previous = previousTime.current;
      previousTime.current = sessionTime;
      if (previous === null) return;
      distance.current = integrateDistance(
        distance.current,
        speed,
        sessionTime - previous
      );
      if (
        formatDistance(distance.current, divisor) !==
        formatDistance(odometer, divisor)
      ) {
        setOdometer(distance.current);
      }
    }
  );
  return (
    <MetricFrame config={config} title="Cruise / odometer">
      <div className="grid grid-cols-2 text-center">
        <div>
          <div className="text-xs text-slate-500">Track</div>
          <div className="font-mono text-lg">
            {position ?? '—'} {unit}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Trip</div>
          <div className="font-mono text-lg">
            {formatDistance(odometer, divisor)} {unit}
          </div>
        </div>
      </div>
    </MetricFrame>
  );
}
