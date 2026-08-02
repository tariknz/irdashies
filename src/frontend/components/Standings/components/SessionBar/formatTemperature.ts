export const formatTemperature = (
  tempC: number | undefined,
  unit: 'Metric' | 'Imperial'
): string => {
  if (tempC === undefined) return '';
  const displayTemp = unit === 'Imperial' ? (tempC * 9) / 5 + 32 : tempC;
  const unitLabel = unit === 'Imperial' ? 'F' : 'C';
  return `${displayTemp.toFixed(0)}°${unitLabel}`;
};
