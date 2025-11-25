export type TimeFormat = 'full' | 'mixed' | 'minutes' | 'seconds-full' | 'seconds-mixed' | 'seconds' | 'duration' | 'duration-wlabels';

export const formatTime = (seconds?: number, format: TimeFormat = 'full'): string => {
  if (!seconds) return '';
  if (seconds < 0) return '';

  const ms = Math.round((seconds % 1) * 1000); // Get milliseconds
  const totalSeconds = Math.floor(seconds); // Get total whole seconds
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
      formattedTime += `:${String(remainingSeconds).padStart(2, '0')}`;
      break;
    case 'duration-wlabels':
      formattedTime = '';
      if (hours > 0) {
        formattedTime += `${hours} Hr${hours > 1 ? 's' : ''}`;
      }
      if (minutes > 0) {
        if (formattedTime) formattedTime += ' ';
        formattedTime += `${minutes} Min${minutes > 1 ? 's' : ''}`;
      }
      if (remainingSeconds > 0) {
        if (formattedTime) formattedTime += ' ';
        formattedTime += `${remainingSeconds} Sec${remainingSeconds > 1 ? 's' : ''}`;
      }
      break;

  }

  return formattedTime;
};
