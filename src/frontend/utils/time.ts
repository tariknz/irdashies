export type TimeFormat =
  | 'full'
  | 'mixed'
  | 'minutes'
  | 'seconds-full'
  | 'seconds-mixed'
  | 'seconds'
  | 'duration'
  | 'duration-wlabels'
  | 'duration-hh:mm:ss'
  | 'duration-hh:mm-wlabel';

export const formatTime = (
  seconds?: number,
  format: TimeFormat = 'full'
): string => {
  if (seconds === undefined) return '';
  if (seconds < 0) return '';

  const totalMs = Math.round(seconds * 1000); // Round once to avoid ms overflow
  const ms = totalMs % 1000; // Get milliseconds (always 0-999)
  const totalSeconds = Math.floor(totalMs / 1000); // Get total whole seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  // Format based on specified format
  let formattedTime = '';

  switch (format) {
    case 'full':
      if (hours > 0) {
        formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
      } else {
        formattedTime = `${minutes}:${String(remainingSeconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
      }
      break;
    case 'mixed': {
      const ms1 = Math.floor(ms / 100); // Get first decimal
      if (hours > 0) {
        formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${ms1}`;
      } else {
        formattedTime = `${minutes}:${String(remainingSeconds).padStart(2, '0')}.${ms1}`;
      }
      break;
    }
    case 'minutes':
      formattedTime = `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
      break;
    case 'seconds-full':
      formattedTime = `${totalSeconds % 60}.${String(ms).padStart(3, '0')}`;
      break;
    case 'seconds-mixed': {
      const ms1Seconds = Math.floor(ms / 100); // Get first decimal
      formattedTime = `${totalSeconds % 60}.${ms1Seconds}`;
      break;
    }
    case 'seconds':
      formattedTime = `${totalSeconds % 60}`;
      break;
    case 'duration':
      formattedTime = '';
      if (hours > 0) {
        formattedTime = `${hours}`;
      }
      if (hours > 0 || minutes > 0) {
        if (formattedTime) formattedTime += ':';
        formattedTime += `${String(minutes).padStart(hours > 0 ? 2 : 0, '0')}`;
      }
      if (hours > 0 || minutes > 0) {
        formattedTime += `:${String(remainingSeconds).padStart(2, '0')}`;
      } else {
        formattedTime = `${remainingSeconds}`;
      }
      break;
    case 'duration-hh:mm:ss':
      formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
      break;
    case 'duration-hh:mm-wlabel':
      formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      if (hours > 0) {
        formattedTime += 'h';
      } else {
        formattedTime += 'min';
      }
      break;
    case 'duration-wlabels':
      formattedTime = '';
      if (hours > 0) {
        formattedTime += `${hours} hr${hours > 1 ? 's' : ''}`;
      }
      if (minutes > 0) {
        if (formattedTime) formattedTime += ' ';
        formattedTime += `${minutes} min${minutes > 1 ? 's' : ''}`;
      }
      if (remainingSeconds > 0) {
        if (formattedTime) formattedTime += ' ';
        formattedTime += `${remainingSeconds} sec${remainingSeconds > 1 ? 's' : ''}`;
      }
      break;
  }

  return formattedTime;
};

/**
 * Formats a time gap (delta, gap, or interval) in seconds.
 * If the gap is 60 seconds or more, it is formatted as MM:SS.
 * Otherwise, it is formatted as a number with the specified decimal places.
 */
export const formatGap = (
  seconds: number | undefined,
  decimalPlaces = 2
): string => {
  if (seconds === undefined) return '';
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  if (absSeconds >= 60) {
    const minutes = Math.floor(absSeconds / 60);
    const remainingSeconds = Math.floor(absSeconds % 60);
    return `${isNegative ? '-' : ''}${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return seconds.toFixed(decimalPlaces);
};

// Format delta with forced sign
export const formatDelta = (delta: number | undefined) => {
  if (delta === undefined || delta === 0) return '---';
  const formatter = new Intl.NumberFormat('en-US', {
    signDisplay: 'always',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(delta);
};
