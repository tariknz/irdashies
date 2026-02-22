import type { ReactNode } from 'react';

export interface FlagContourProps {
  children: ReactNode;
  compactMode?: boolean;
  flags?: { enabled: boolean };
  flagColor?: string;
  backgroundOpacity?: number;
}

export const FlagContour = ({
  children,
  compactMode = false,
  flags = { enabled: false },
  flagColor,
  backgroundOpacity = 0,
}: FlagContourProps) => {
  const containerClassName = `w-full bg-slate-800/(--bg-opacity) rounded-sm ${
    !compactMode ? 'p-2' : ''
  } overflow-hidden ${flags.enabled ? 'border-10 border-solid' : ''}`;

  const containerStyle = {
    ['--bg-opacity' as string]: `${backgroundOpacity}%`,
    ...(flags.enabled && flagColor && { borderColor: flagColor }),
  };

  return (
    <div className={containerClassName} style={containerStyle}>
      {children}
    </div>
  );
};
FlagContour.displayName = 'FlagContour';
