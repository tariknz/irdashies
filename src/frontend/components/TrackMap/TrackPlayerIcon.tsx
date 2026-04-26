import { memo } from 'react';

interface TrackPlayerIconProps {
  overlay: { style: React.CSSProperties; onPitRoad: boolean } | null;
  iconDataUrl: string;
}

export const TrackPlayerIcon = memo(
  ({ overlay, iconDataUrl }: TrackPlayerIconProps) => {
    if (!overlay) return null;

    return (
      <div className="absolute pointer-events-none" style={overlay.style}>
        <img src={iconDataUrl} alt="" className="w-full h-full" />
        {overlay.onPitRoad && (
          <span className="absolute inset-0 flex items-center justify-center font-bold text-white">
            P
          </span>
        )}
      </div>
    );
  }
);
TrackPlayerIcon.displayName = 'TrackPlayerIcon';
