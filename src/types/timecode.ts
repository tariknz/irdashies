/** Formats a session-time number of seconds as `HH:MM:SS` (always two-digit
 * groups, floored). Returns `00:00:00` for negative or non-finite input. */
export const formatTimecode = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00';
  const s = Math.floor(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
