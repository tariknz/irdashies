import { useSessionLapsTiming, useSessionTimeTiming } from '@irdashies/context';
import type { BroadcastTheme } from '@irdashies/types';
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

const SessionClock = () => {
  const { sessionType, timeRemaining, isFixedLapRace, state } =
    useSessionTimeTiming();
  const { currentLap, totalRaceLaps } = useSessionLapsTiming();
  // iRacing keeps the clock and lap counter running through the cool-down.
  if (isSessionFinished(state)) return <>FINISH</>;
  if (sessionType === 'Race' && isFixedLapRace && totalRaceLaps > 0) {
    return (
      <>
        LAP {currentLap} / {totalRaceLaps}
      </>
    );
  }
  return <>{formatTime(Math.max(timeRemaining, 0), 'duration')}</>;
};

export const TowerHeader = ({
  title,
  logo,
  theme,
}: {
  title: string;
  logo?: string;
  theme: BroadcastTheme;
}) => (
  <div
    className={`rounded-t-sm px-2 py-0.5 text-center font-bold leading-tight tracking-wide uppercase ${THEMES[theme].header}`}
  >
    {isImageDataUrl(logo) && (
      <img src={logo} alt="" className="mx-auto max-h-12 py-1" />
    )}
    <div className="truncate text-base">{title}</div>
    <div className="text-lg tabular-nums">
      <SessionClock />
    </div>
  </div>
);
