export interface DriverRatingBadgeProps {
  license?: string;
  rating?: number;
  format?:
    | 'license-color-fullrating-bw'
    | 'license-color-rating-bw'
    | 'license-color-rating-bw-no-license'
    | 'rating-color-no-license'
    | 'license-bw-rating-bw'
    | 'rating-only-bw-rating-bw'
    | 'license-bw-rating-bw-no-license'
    | 'rating-bw-no-license'
    | 'rating-only-color-rating-bw';
  isMinimal?: boolean;
}

export const DriverRatingBadge = ({
  license = 'R 0.0',
  rating = 0,
  format = 'license-color-rating-bw',
  isMinimal = false,
}: DriverRatingBadgeProps) => {
  const licenseLevel = license?.charAt(0) || 'R';
  // Static maps required so Tailwind's scanner picks up all class names
  const defaultColorMap: Record<string, string> = {
    W: 'border-zinc-100 bg-zinc-500',
    P: 'border-purple-500 bg-purple-800',
    A: 'border-blue-500 bg-blue-800',
    B: 'border-green-500 bg-green-800',
    C: 'border-yellow-500 bg-yellow-700',
    D: 'border-orange-500 bg-orange-700',
    R: 'border-red-500 bg-red-800',
  };
  const minimalColorMap: Record<string, string> = {
    W: 'border-zinc-500 bg-zinc-500',
    P: 'border-purple-800 bg-purple-800',
    A: 'border-blue-800 bg-blue-800',
    B: 'border-green-800 bg-green-800',
    C: 'border-yellow-700 bg-yellow-700',
    D: 'border-orange-700 bg-orange-700',
    R: 'border-red-800 bg-red-800',
  };
  const color =
    (isMinimal ? minimalColorMap : defaultColorMap)[licenseLevel] ?? '';

  // In minimal mode, strip the border from badges — keep only the bg class
  const colorBg = color.split(' ').find((c) => c.startsWith('bg-')) ?? '';
  const coloredClass = `${colorBg} border-2 ${color}`;
  const bwClass = isMinimal
    ? 'bg-white/10 border-transparent'
    : 'bg-white/10 border-2 border-transparent';

  const decimal = String(rating / 1000);
  const dotIndex = decimal.indexOf('.') > -1 ? decimal.indexOf('.') : 0;
  const simplifiedRating = Number(decimal.substring(0, dotIndex + 2)).toFixed(
    1
  );

  // Extract safety rating number from license string
  const safetyRatingMatch = license?.match(/([A-Z])\s*(\d+\.\d+)/);
  const safetyRating = safetyRatingMatch
    ? (Math.floor(parseFloat(safetyRatingMatch[2]) * 10) / 10).toFixed(1)
    : '';
  const formattedLicense =
    license?.replace(/([A-Z])\s*(\d+)\.(\d+)/, (_, level) => {
      return `${level}`;
    }) ||
    license ||
    'R 0.0';

  switch (format) {
    case 'license-color-fullrating-bw':
      // License = colored badge, full irating (no 1.4k approx), rating in B&W
      return (
        <div className="flex gap-1 items-center">
          <div
            className={`text-white text-nowrap ${coloredClass} px-1 rounded-md text-xs leading-tight`}
          >
            {formattedLicense} {safetyRating}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {rating}
          </div>
        </div>
      );

    case 'license-color-rating-bw':
      // Default format: License + colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`text-white text-nowrap ${coloredClass} px-1 rounded-md text-xs leading-tight`}
          >
            {formattedLicense} {safetyRating}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-only-color-rating-bw':
      // Rating only in colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`text-white text-nowrap ${coloredClass} px-1 rounded-md text-xs leading-tight`}
          >
            {safetyRating}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'license-color-rating-bw-no-license':
      // License without safety rating + colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`text-white text-nowrap ${coloredClass} px-1 rounded-md text-xs leading-tight`}
          >
            {formattedLicense}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-color-no-license':
      // Rating only in colored badge, no license
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`text-white text-nowrap ${coloredClass} px-1 rounded-md text-xs leading-tight`}
          >
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'license-bw-rating-bw':
      // All B&W badges - license without safety rating (like current but B&W)
      return (
        <div className="flex gap-1 items-center mx-2">
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {formattedLicense} {safetyRating}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-only-bw-rating-bw':
      // Rating only in colored badge, rating in B&W
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`${bwClass} text-white px-1 rounded-md text-xs leading-tight`}
          >
            {safetyRating}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'license-bw-rating-bw-no-license':
      // All B&W badges - license without safety rating
      return (
        <div className="flex gap-1 items-center mx-2">
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {formattedLicense}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );

    case 'rating-bw-no-license':
      // Rating only in B&W
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`text-white text-nowrap ${bwClass} px-1 rounded-md text-xs leading-tight`}
          >
            {simplifiedRating}k
          </div>
        </div>
      );

    default:
      // Fallback to default format
      return (
        <div className="flex gap-1 items-center mx-2">
          <div
            className={`text-white text-nowrap ${coloredClass} px-1 rounded-md text-xs leading-tight`}
          >
            {formattedLicense} {safetyRating}
          </div>
          <div className="${bwClass} text-white px-1 rounded-md text-xs leading-tight">
            {simplifiedRating}k
          </div>
        </div>
      );
  }
};
