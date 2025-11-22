export const formatTime = (seconds?: number): string => {
  if (!seconds) return '';
  if (seconds < 0) return '';

  const ms = Math.floor((seconds % 1) * 1000); // Get milliseconds
  const totalSeconds = Math.floor(seconds); // Get total whole seconds
  const minutes = Math.floor(totalSeconds / 60); // Get minutes
  const remainingSeconds = totalSeconds % 60; // Get remaining seconds

  // Format as mm:ss:ms
  const formattedTime = `${minutes}:${String(remainingSeconds).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;

  return formattedTime;
};

export const formatTimeShort = (
  seconds?: number,
  timeSeconds?: boolean
): string => {
  if (!seconds) return '';
  if (seconds < 0) return '';

  const totalSeconds = Math.floor(seconds); // Get total whole seconds
  const minutes = Math.floor(totalSeconds / 60); // Get minutes
  const remainingSeconds = totalSeconds % 60; // Get remaining seconds

  // Format as mm:ss
  if (timeSeconds && remainingSeconds === 0) return `${minutes}`; // Only minutes if no seconds
  const formattedTime = `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;

  return formattedTime;
};

export const formatTimeElapsedHMS = (seconds?: number): string => {
  if (!seconds) return '';
  if (seconds < 0) return '';

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
};

export const formatTimeRemaining = (seconds?: number): string => {
  if (!seconds) return '';
  if (seconds < 0) return '';

  const totalSeconds = Math.floor(seconds);
  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes >= 60) {
    const hours = Math.round(totalSeconds / 3600);
    return `${hours} hr`;
  } else if (totalMinutes > 0) {
    const remainingMinutes = totalMinutes;
    const remainingSeconds = totalSeconds % 60;
    if (remainingSeconds === 0) {
      return `${remainingMinutes} min`;
    } else {
      return `${remainingMinutes}:${String(remainingSeconds).padStart(2, '0')} min`;
    }
  } else if (totalSeconds > 0) {
    return `${totalSeconds} sec`;
  }
  return '';
};
