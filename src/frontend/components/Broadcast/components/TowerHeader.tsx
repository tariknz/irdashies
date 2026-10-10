import { useEffect, useState } from 'react';
import { ClockIcon } from '@phosphor-icons/react';
import {
  useSessionBarSelector,
  useSessionLapsTiming,
  useSessionTimeTiming,
} from '@irdashies/context';
import type { BroadcastHeaderClock, BroadcastTheme } from '@irdashies/types';
import { formatTime } from '@irdashies/utils/time';
import { isSessionFinished } from '../broadcastRows';

/** Tower look per series style; class names stay literal for Tailwind. */
export const THEMES: Record<
  BroadcastTheme,
  { header: string; panel: string; position: string }
> = {
  imsa: {
    header:
      'border border-white/20 bg-linear-to-b from-slate-700 to-slate-950 text-cyan-300 italic',
    panel: 'bg-slate-950/(--bg-opacity)',
    position: '',
  },
  wec: {
    header: 'bg-linear-to-r from-sky-700 to-blue-950 text-white italic',
    panel: 'bg-blue-950/(--bg-opacity)',
    position: '',
  },
  f1: {
    header: 'bg-red-600 text-white',
    panel: 'bg-zinc-900/(--bg-opacity)',
    position: 'rounded-xs bg-white text-center text-slate-900 not-italic',
  },
};

/** Only inline images are shown; the config is user-editable JSON. */
const isImageDataUrl = (src?: string): src is string =>
  !!src && src.startsWith('data:image/');

/** Minutes since midnight as a wall clock, e.g. 14:32. */
const formatClock = (minutes: number) => {
  const date = new Date();
  date.setHours(0, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const nowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

/** Time of day in the sim, which can differ from the real one. */
const TrackTime = () => {
  const minutes = useSessionBarSelector((s) =>
    s.sessionTimeOfDay === undefined
      ? undefined
      : Math.floor(s.sessionTimeOfDay / 60)
  );
  return minutes === undefined ? null : <>{formatClock(minutes)}</>;
};

const LocalTime = () => {
  const [minutes, setMinutes] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setMinutes(nowMinutes()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatClock(minutes)}</>;
};

const SessionClock = ({ withBoth }: { withBoth: boolean }) => {
  const { sessionType, time, timeRemaining, isFixedLapRace, state } =
    useSessionTimeTiming();
  const { currentLap, totalRaceLaps } = useSessionLapsTiming();
  // iRacing keeps the clock and lap counter running through the cool-down.
  if (isSessionFinished(state)) return <>FINISH</>;
  const lapRace = sessionType === 'Race' && isFixedLapRace && totalRaceLaps > 0;
  const remaining = formatTime(Math.max(timeRemaining, 0), 'duration');
  if (withBoth) {
    // A lap race has no time left to count down, so it shows time elapsed.
    return (
      <>
        LAP {currentLap}
        {lapRace && ` / ${totalRaceLaps}`}
        <span className="text-white/70"> · </span>
        {lapRace ? formatTime(time, 'duration') : remaining}
      </>
    );
  }
  if (lapRace) {
    return (
      <>
        LAP {currentLap} / {totalRaceLaps}
      </>
    );
  }
  return <>{remaining}</>;
};

export const TowerHeader = ({
  title,
  logo,
  theme,
  clock = 'session',
}: {
  title: string;
  logo?: string;
  theme: BroadcastTheme;
  clock?: BroadcastHeaderClock;
}) => (
  <div
    className={`rounded-t-sm px-2 py-0.5 text-center font-bold leading-tight tracking-wide uppercase ${THEMES[theme].header}`}
  >
    {isImageDataUrl(logo) && (
      <img src={logo} alt="" className="mx-auto max-h-12 py-1" />
    )}
    <div className="truncate text-base">{title}</div>
    <div className="text-lg tabular-nums">
      <SessionClock withBoth={clock === 'laps-time'} />
      {(clock === 'session-track' || clock === 'session-local') && (
        <span className="ml-2 inline-flex items-center gap-1 text-sm opacity-80">
          <ClockIcon size={14} weight="bold" />
          {clock === 'session-track' ? <TrackTime /> : <LocalTime />}
        </span>
      )}
    </div>
  </div>
);
