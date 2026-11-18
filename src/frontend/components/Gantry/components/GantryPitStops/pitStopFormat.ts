/** 38.2 s, or 1:04.5 from a minute up. */
export const formatStopSeconds = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return '-';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
};

/** Session clock as h:mm:ss. */
export const formatSessionClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '-';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/** +1, -2 or 0. */
export const formatSigned = (value: number, digits = 0): string => {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
};
