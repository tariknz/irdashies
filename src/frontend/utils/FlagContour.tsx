import type { ReactNode } from 'react';

export interface FlagContourProps {
  children: ReactNode;
  compactMode?: boolean;
  flags?: { enabled: boolean };
  flagColor?: string;
  backgroundOpacity?: number;
  borderWidth?: number;
}

export const FlagContour = ({
  children,
  compactMode = false,
  flags = { enabled: false },
  flagColor,
  backgroundOpacity = 0,
  borderWidth = 5,
}: FlagContourProps) => {
  const containerClassName = `w-full bg-slate-800/(--bg-opacity) rounded-sm ${
    !compactMode ? 'p-2' : ''
  } overflow-hidden ${flags.enabled ? 'border-solid' : ''}`;

  const containerStyle = {
    ['--bg-opacity' as string]: `${backgroundOpacity}%`,
    ...(flags.enabled &&
      flagColor && { borderColor: flagColor, borderWidth: `${borderWidth}px` }),
  };

  return (
    <div className={containerClassName} style={containerStyle}>
      {children}
    </div>
  );
};
FlagContour.displayName = 'FlagContour';
