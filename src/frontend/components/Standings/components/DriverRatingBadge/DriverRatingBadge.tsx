

export interface DriverRatingBadgeProps {
  license?: string;
  rating?: number;
  format?: 'license-color-fullrating-bw' |'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' | 'rating-only-color-rating-bw';
}

export const DriverRatingBadge = ({
  license = 'R 0.0',
  rating = 0,
  format = 'license-color-rating-bw',
}: DriverRatingBadgeProps) => {
  const licenseLevel = license?.charAt(0) || 'R';
  const colorMap: Record<string, string> = {
    W: 'border-zinc-100 bg-zinc-500',
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
  const safetyRatingMatch = license?.match(/([A-Z])\s*(\d+\.\d+)/);
  const safetyRating = safetyRatingMatch ? (Math.floor(parseFloat(safetyRatingMatch[2]) * 10) / 10).toFixed(1) : '';
  const formattedLicense = license?.replace(/([A-Z])\s*(\d+)\.(\d+)/, (_, level) => {
    return `${level}`;
  }) || license || 'R 0.0';

  switch (format) {
    case 'license-color-fullrating-bw':
      // License = colored badge, full irating (no 1.4k approx), rating in B&W
      return (
        <div className="flex gap-1 items-center">
          <div
            className={`text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight ${color}`}
          >
            {formattedLicense} {safetyRating}
          </div>
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {rating}
          </div>
        </div>
      );

    case 'license-color-rating-bw':
      // Default format: License + colored badge, rating in B&W
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

    case 'rating-only-color-rating-bw':
      // Rating only in colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center">
          <div
            className={`text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight ${color}`}
          >
            {safetyRating}
          </div>
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'license-color-rating-bw-no-license':
      // License without safety rating + colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center">
          <div
            className={`text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight ${color}`}
          >
            {formattedLicense}
          </div>
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-color-no-license':
      // Rating only in colored badge, no license
      return (
        <div className={`text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight ${color}`}>
          {simplifiedRating}k
        </div>
      );

    case 'license-bw-rating-bw':
      // All B&W badges - license without safety rating (like current but B&W)
      return (
        <div className="flex gap-1 items-center">
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {formattedLicense} {safetyRating}
          </div>
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-only-bw-rating-bw':
      // Rating only in colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center">
          <div
            className={`bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight`}
          >
            {safetyRating}
          </div>
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'license-bw-rating-bw-no-license':
      // All B&W badges - license without safety rating
      return (
        <div className="flex gap-1 items-center">
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {formattedLicense}
          </div>
          <div className="bg-white/10 text-white border-2 border-transparent px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-bw-no-license':
      // Rating only in B&W
      return (
        <div className="text-white text-nowrap border-2 px-1 rounded-md text-xs leading-tight bg-white/10 border-transparent">
          {simplifiedRating}k
        </div>
      );

    default:
      // Fallback to default format
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
  }
};
