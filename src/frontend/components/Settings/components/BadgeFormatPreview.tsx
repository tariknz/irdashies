import type { StandingsBadgeFormat } from '@irdashies/types';
import { DriverRatingBadge } from '../../Standings/components/DriverRatingBadge/DriverRatingBadge';

interface BadgeFormatPreviewProps {
  format: string;
  selected: boolean;
  onClick: () => void;
  iratingChange?: number;
}

// Badge preview component to show different formats
export const BadgeFormatPreview = ({
  format,
  selected,
  onClick,
  iratingChange,
}: BadgeFormatPreviewProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded border cursor-pointer transition-colors inline-flex items-center justify-center ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-transparent hover:bg-slate-800'
      }`}
    >
      <DriverRatingBadge
        license="B 3.8"
        rating={1412}
        format={format as StandingsBadgeFormat}
        iratingChange={iratingChange}
        noMargin={true}
      />
    </button>
  );
};
