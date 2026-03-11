/** this function reads the short label of a flag and returns the corresponding text color class */

export const getTextColorClass = (shortLabel: string) => {
  if (shortLabel === 'NO') return 'text-slate-500';
    if (shortLabel === 'GREEN') return 'text-green-500';
    if (shortLabel === 'YELLOW') return 'text-yellow-400';
    if (shortLabel === 'BLUE') return 'text-blue-500';
    if (shortLabel === 'RED') return 'text-red-500';
    if (shortLabel === 'WHITE') return 'text-white';
    if (shortLabel === 'MEATBALL') return 'text-orange-500';
    if (shortLabel === 'DEBRIS') return 'text-yellow-400';
    if (shortLabel === 'CHECKERED') return 'text-white';
    if (shortLabel === 'BLACK') return 'text-white';
  if (shortLabel === 'DISQUALIFIED') return 'text-red-500';
  return 'text-white';
};