import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlagIcon, WarningIcon } from '@phosphor-icons/react';
import {
  trackStateSelectors,
  useDashboard,
  useSessionVisibility,
  useTrackStateSelector,
} from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { Standings } from '@irdashies/domain';
import { getTailwindStyle } from '@irdashies/utils/colors';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../shared/DriverName/DriverName';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { useBroadcastEventsSettings } from './hooks/useBroadcastEventsSettings';
import {
  demoEvent,
  eventFromIncident,
  flagKind,
  type BroadcastEvent,
  type EventKind,
} from './broadcastEvents';

/** Events waiting beyond this are dropped; a pile-up shows its first cars. */
const MAX_QUEUE = 4;
/** A flag that follows an incident this soon is shown with that car. */
const FLAG_LINK_MS = 15_000;

const KIND_STYLE: Record<
  EventKind,
  { title: string; bar: string; flag?: string }
> = {
  crash: { title: 'Incident', bar: 'bg-red-600 text-white' },
  offTrack: { title: 'Off Track', bar: 'bg-amber-500 text-slate-900' },
  slowdown: { title: 'Slow Car', bar: 'bg-orange-500 text-slate-900' },
  blackFlag: {
    title: 'Black Flag',
    bar: 'bg-black text-white',
    flag: 'text-white',
  },
  yellow: {
    title: 'Yellow Flag',
    bar: 'bg-yellow-400 text-slate-900',
    flag: 'text-yellow-400',
  },
  caution: {
    title: 'Full Course Yellow',
    bar: 'bg-yellow-400 text-slate-900',
    flag: 'text-yellow-400',
  },
};

/** Shows queued events one at a time, each for `showSeconds`. */
const useEventQueue = (showSeconds: number) => {
  const [queue, setQueue] = useState<BroadcastEvent[]>([]);
  const push = useCallback(
    (event: BroadcastEvent) =>
      setQueue((q) =>
        q.some((e) => e.id === event.id) ? q : [...q, event].slice(0, MAX_QUEUE)
      ),
    []
  );
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(
      () => setQueue((q) => q.slice(1)),
      showSeconds * 1000
    );
    return () => clearTimeout(id);
  }, [current, showSeconds]);
  return { current, push };
};

const DriverCard = ({
  event,
  standing,
}: {
  event: BroadcastEvent;
  standing?: Standings;
}) => {
  const name = standing?.driver.name ?? event.driverName ?? '';
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {standing?.classPosition !== undefined && (
        <span className="text-2xl font-bold italic">
          P{standing.classPosition}
        </span>
      )}
      <span
        className={`rounded-xs px-1.5 text-lg font-bold italic text-slate-900 ${
          standing
            ? getTailwindStyle(standing.carClass.color, undefined, true)
                .classHeader
            : 'bg-white'
        }`}
      >
        {standing?.driver.carNum ?? event.carNumber}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold italic uppercase">
          {formatDriverName(extractDriverName(name), 'name-surname')}
        </div>
        <div className="truncate text-sm text-white/60">
          {[standing?.carClass.name, standing?.driver.teamName]
            .filter(Boolean)
            .join(' · ')}
          {event.lap ? ` · Lap ${event.lap}` : ''}
        </div>
      </div>
      {standing?.carId !== undefined && (
        <span className="text-3xl">
          <CarManufacturer carId={standing.carId} />
        </span>
      )}
    </div>
  );
};

export const BroadcastEvents = () => {
  const { isDemoMode } = useDashboard();
  const settings = useBroadcastEventsSettings();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const groups = useDriverStandings(undefined, { showAll: true });
  const byCarIdx = useMemo(
    () => new Map(groups.flatMap(([, d]) => d).map((s) => [s.carIdx, s])),
    [groups]
  );
  const showSeconds = settings?.showSeconds ?? 8;
  const { current, push } = useEventQueue(showSeconds);
  const kinds = settings?.kinds;
  const lastIncident = useRef<{ event: BroadcastEvent; at: number }>(undefined);

  useEffect(
    () =>
      window.channelBridge?.subscribe('raceControl.incidents', (incident) => {
        const event = eventFromIncident(incident);
        if (!event) return;
        lastIncident.current = { event, at: Date.now() };
        if (kinds?.[event.kind] !== false) push(event);
      }),
    [kinds, push]
  );

  const sessionFlags =
    useTrackStateSelector(trackStateSelectors.sessionFlags) ?? 0;
  const prevFlags = useRef(sessionFlags);
  useEffect(() => {
    const kind = flagKind(prevFlags.current, sessionFlags);
    prevFlags.current = sessionFlags;
    if (!kind || kinds?.[kind] === false) return;
    const recent = lastIncident.current;
    const linked =
      recent && Date.now() - recent.at < FLAG_LINK_MS ? recent.event : {};
    push({ ...linked, kind, id: `${kind}-${Date.now()}` });
  }, [sessionFlags, kinds, push]);

  // Demo telemetry never crashes or flags, so make events up on real cars.
  const carIdxs = useRef<number[]>([]);
  useEffect(() => {
    carIdxs.current = [...byCarIdx.keys()];
  }, [byCarIdx]);
  useEffect(() => {
    if (!isDemoMode) return;
    let n = 0;
    const fire = () => {
      const event = demoEvent(n++, carIdxs.current, kinds);
      if (event) push(event);
    };
    const first = setTimeout(fire, 1000);
    const next = setInterval(fire, (showSeconds + 1) * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(next);
    };
  }, [isDemoMode, kinds, push, showSeconds]);

  if ((!isDemoMode && !isSessionVisible) || !current) return null;

  const style = KIND_STYLE[current.kind];
  const standing =
    current.carIdx !== undefined ? byCarIdx.get(current.carIdx) : undefined;
  const hasCar = current.carIdx !== undefined || !!current.carNumber;

  return (
    <div
      key={current.id}
      className="w-full animate-broadcast-enter overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) text-white shadow-lg"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 90}%`,
      }}
    >
      <div
        className={`flex items-center gap-2 px-3 py-1 text-lg font-bold italic uppercase ${style.bar}`}
      >
        {style.flag ? (
          <FlagIcon
            size={22}
            weight="fill"
            className={`origin-bottom-left animate-[broadcast-wave_0.6s_ease-in-out_infinite_alternate] ${style.flag} drop-shadow`}
          />
        ) : (
          <WarningIcon size={22} weight="fill" className="animate-pulse" />
        )}
        {style.title}
      </div>
      {hasCar && <DriverCard event={current} standing={standing} />}
    </div>
  );
};
