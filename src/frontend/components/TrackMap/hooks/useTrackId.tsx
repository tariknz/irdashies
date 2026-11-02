import { useSessionStore } from '@irdashies/context';

const LMU_TRACK_MAP_ALIASES = [
  { trackId: 463, names: ['imola', 'enzoedinoferrari'] },
  { trackId: 95, names: ['sebring'] },
  { trackId: 239, names: ['monza'] },
  { trackId: 329, names: ['interlagos', 'josecarlospace'] },
  { trackId: 341, names: ['silverstone'] },
  { trackId: 509, names: ['portimao', 'algarve'] },
] as const;

export const resolveTrackMapId = (
  trackId: number | undefined,
  trackName: string | undefined,
  simMode: string | undefined
) => {
  if (simMode !== 'Le Mans Ultimate') return trackId;
  const normalized = trackName?.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return LMU_TRACK_MAP_ALIASES.find(({ names }) =>
    names.some((name) => normalized?.includes(name))
  )?.trackId;
};

export const useTrackId = () => {
  const session = useSessionStore((state) => state.session);
  return resolveTrackMapId(
    session?.WeekendInfo?.TrackID,
    session?.WeekendInfo?.TrackName,
    session?.WeekendInfo?.SimMode
  );
};
