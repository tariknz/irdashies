// compact=true (total time): trims trailing zero components, never shows seconds
// compact=false (elapsed/remaining): always shows full HH:MM:SS
export const formatTotalTime = (
  seconds: number,
  totalFormat: 'hh:mm' | 'minimal',
  compact: boolean,
  labelStyle: 'none' | 'short' | 'minimal'
): string => {
  if (seconds < 0) return '-';
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  let result: string;
  if (totalFormat === 'hh:mm') {
    if (compact && minutes === 0 && hours > 0) {
      result = String(hours).padStart(2, '0');
    } else {
      result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      if (!compact) result += `:${String(secs).padStart(2, '0')}`;
    }
  } else {
    // minimal
    if (compact) {
      if (hours > 0) {
        if (minutes === 0) {
          result = `${hours}`;
        } else if (secs > 0) {
          result = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          result = `${hours}:${String(minutes).padStart(2, '0')}`;
        }
      } else {
        result =
          secs > 0
            ? `${minutes}:${String(secs).padStart(2, '0')}`
            : `${minutes}`;
      }
    } else {
      // elapsed/remaining: trim leading zero components
      if (hours > 0) {
        result = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      } else if (minutes > 0) {
        result = `${minutes}:${String(secs).padStart(2, '0')}`;
      } else {
        result = `${secs}`;
      }
    }
  }

  if (labelStyle === 'short')
    result += hours > 0 ? ' hrs' : minutes > 0 ? ' mins' : ' secs';
  else if (labelStyle === 'minimal')
    result += hours > 0 ? ' h' : minutes > 0 ? ' m' : ' s';
  return result;
};
