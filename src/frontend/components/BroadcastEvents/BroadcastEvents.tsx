import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlagCheckeredIcon,
  FlagIcon,
  ProhibitIcon,
  TimerIcon,
  WarningIcon,
  WrenchIcon,
  type Icon,
} from '@phosphor-icons/react';
import {
  trackStateSelectors,
  useDashboard,
  useSessionVisibility,
  useTrackStateSelector,
} from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { Standings } from '@irdashies/domain';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { clampSetting } from '@irdashies/utils/clampSetting';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../shared/DriverName/DriverName';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { BroadcastEnter } from '../Broadcast/BroadcastEnter';
import { useBroadcastConfig } from '../Broadcast/hooks/useBroadcastConfig';
import {
  carEvents,
  demoEvent,
  emptyCarTracker,
  eventFromIncident,
  flagKind,
  type BroadcastEvent,
  type EventKind,
} from './broadcastEvents';

/** Events waiting beyond this are dropped; a pile-up shows its first cars. */
const MAX_QUEUE = 4;
/** A flag that follows an incident this soon is shown with that car. */
const FLAG_LINK_MS = 15_000;

interface KindStyle {
  title: string;
  bar: string;
  icon: Icon;
  /** Colour of a waving flag; other icons pulse instead. */
  flag?: string;
}

const KIND_STYLE: Record<EventKind, KindStyle> = {
  crash: { title: 'Incident', bar: 'bg-red-600 text-white', icon: WarningIcon },
  offTrack: {
    title: 'Off Track',
    bar: 'bg-amber-500 text-slate-900',
    icon: WarningIcon,
  },
  slowdown: {
    title: 'Slow Car',
    bar: 'bg-orange-500 text-slate-900',
    icon: WarningIcon,
  },
  blackFlag: {
    title: 'Black Flag',
    bar: 'bg-black text-white',
    icon: FlagIcon,
    flag: 'text-white',
  },
  yellow: {
    title: 'Yellow Flag',
    bar: 'bg-yellow-400 text-slate-900',
    icon: FlagIcon,
    flag: 'text-yellow-400',
  },
  caution: {
    title: 'Full Course Yellow',
    bar: 'bg-yellow-400 text-slate-900',
    icon: FlagIcon,
    flag: 'text-yellow-400',
  },
  fastestLap: {
    title: 'Fastest Lap',
    bar: 'bg-purple-600 text-white',
    icon: TimerIcon,
  },
  pitStop: {
    title: 'Pit Stop',
    bar: 'bg-sky-600 text-white',
    icon: WrenchIcon,
  },
  meatball: {
    title: 'Meatball Flag',
    bar: 'bg-black text-white',
    icon: FlagIcon,
    flag: 'text-orange-500',
  },
  disqualified: {
    title: 'Disqualified',
    bar: 'bg-black text-red-400',
    icon: ProhibitIcon,
  },
  finalLap: {
    title: 'Final Lap',
    bar: 'bg-white text-slate-900',
    icon: FlagIcon,
    flag: 'text-slate-300',
  },
  checkered: {
    title: 'Checkered Flag',
    bar: 'bg-white text-slate-900',
    icon: FlagCheckeredIcon,
    flag: 'text-slate-900',
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
        {event.detail && (
          <div className="text-lg font-bold tabular-nums">{event.detail}</div>
        )}
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
  const settings = useBroadcastConfig('broadcastevents');
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const groups = useDriverStandings(undefined, { showAll: true });
  const byCarIdx = useMemo(
    () => new Map(groups.flatMap(([, d]) => d).map((s) => [s.carIdx, s])),
    [groups]
  );
  const showSeconds = clampSetting(settings?.showSeconds, 3, 20, 8);
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

  // Pit stops, fastest laps, meatballs and DQs come from the standings.
  // A new session starts from a fresh baseline: last session's best lap
  // would otherwise hide every fastest lap of this one.
  const sessionNum = useTrackStateSelector(trackStateSelectors.sessionNum);
  const tracker = useRef({ sessionNum, state: emptyCarTracker() });
  useEffect(() => {
    if (tracker.current.sessionNum !== sessionNum) {
      tracker.current = { sessionNum, state: emptyCarTracker() };
    }
    // Pit lane time is wall-clock, so it is only right for live or 1x replay.
    const out = carEvents(
      tracker.current.state,
      [...byCarIdx.values()],
      Date.now()
    );
    tracker.current.state = out.tracker;
    out.events.filter((e) => kinds?.[e.kind] !== false).forEach((e) => push(e));
  }, [byCarIdx, kinds, push, sessionNum]);

  const sessionFlags = useTrackStateSelector(trackStateSelectors.sessionFlags);
  const prevFlags = useRef<number | undefined>(undefined);
  useEffect(() => {
    // The first delivered value is a baseline, not a flag change.
    if (sessionFlags == null) return;
    const prev = prevFlags.current;
    prevFlags.current = sessionFlags;
    if (prev === undefined) return;
    const kind = flagKind(prev, sessionFlags);
    if (!kind || kinds?.[kind] === false) return;
    const id = `${kind}-${Date.now()}`;
    if (kind === 'finalLap') return push({ id, kind });
    if (kind === 'checkered') {
      // Show the overall winner; the podium screen has every class.
      const winner = [...byCarIdx.values()].find((s) => s.position === 1);
      return push({ id, kind, carIdx: winner?.carIdx });
    }
    const recent = lastIncident.current;
    const linked =
      recent && Date.now() - recent.at < FLAG_LINK_MS ? recent.event : {};
    push({ ...linked, kind, id });
  }, [sessionFlags, kinds, push, byCarIdx]);

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

  return (
    <EventCard
      event={current}
      standing={
        current.carIdx !== undefined ? byCarIdx.get(current.carIdx) : undefined
      }
      opacity={settings?.background?.opacity}
    />
  );
};

/** One event card, drawn from what it is handed (the settings preview too). */
export const EventCard = ({
  event,
  standing,
  opacity = 90,
}: {
  event: BroadcastEvent;
  standing?: Standings;
  opacity?: number;
}) => {
  const style = KIND_STYLE[event.kind];
  const hasCar = event.carIdx !== undefined || !!event.carNumber;

  return (
    <BroadcastEnter
      id={event.id}
      className="w-full overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) text-white shadow-lg"
      style={{
        ['--bg-opacity' as string]: `${opacity}%`,
      }}
    >
      <div
        className={`flex items-center gap-2 px-3 py-1 text-lg font-bold italic uppercase ${style.bar}`}
      >
        <style.icon
          size={22}
          weight="fill"
          className={
            style.flag
              ? `origin-bottom-left animate-[broadcast-wave_0.6s_ease-in-out_infinite_alternate] ${style.flag} drop-shadow`
              : 'animate-pulse'
          }
        />
        {style.title}
      </div>
      {hasCar && <DriverCard event={event} standing={standing} />}
    </BroadcastEnter>
  );
};
