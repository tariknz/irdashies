export interface DriverRatingBadgeProps {
  license?: string;
  rating?: number;
}

export const DriverRatingBadge = ({
  license = 'R 0.0',
  rating = 0,
}: DriverRatingBadgeProps) => {
  const licenseLevel = license?.charAt(0) || 'R';
  const colorMap: Record<string, string> = {
    P: 'border-purple-500 bg-purple-800',
    A: 'border-blue-500 bg-blue-800',
    B: 'border-green-500 bg-green-800',
    C: 'border-yellow-500 bg-yellow-700',
    D: 'border-orange-500 bg-orange-700',
    R: 'border-red-500 bg-red-800',
  };
  const color = colorMap[licenseLevel] ?? '';

  let fixed = 1;
  if (rating >= 10000) fixed = 0;
  const simplifiedRating = (rating / 1000).toFixed(fixed);

  // Extract safety rating number from license string
  const safetyRatingMatch = license.match(/([A-Z])\s*(\d+\.\d+)/);
  const safetyRating = safetyRatingMatch ? parseFloat(safetyRatingMatch[2]).toFixed(1) : '';
  const formattedLicense = license?.replace(/([A-Z])\s*(\d+)\.(\d+)/, (_, level) => {
    return `${level}`;
  }) || license || 'R 0.0';

  return (
    <div className="flex gap-1 items-center">
      <div
        className={`text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight ${color}`}
      >
        {formattedLicense} {safetyRating}
      </div>
      <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
        {simplifiedRating}k
      </div>
    </div>
  );
};
