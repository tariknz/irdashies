import type { ReactNode } from 'react';

export interface FlagContourProps {
  children: ReactNode;
  compactMode?: boolean;
  showFlag?: boolean;
  flagColor?: string;
  backgroundOpacity?: number;
}

export const FlagContour = ({
  children,
  compactMode = false,
  showFlag = false,
  flagColor,
  backgroundOpacity = 0,
}: FlagContourProps) => {
  const containerClassName = `w-full bg-slate-800/(--bg-opacity) rounded-sm ${
    !compactMode ? 'p-2' : ''
  } overflow-hidden ${showFlag ? 'border-10 border-solid' : ''}`;

  const containerStyle = {
    ['--bg-opacity' as string]: `${backgroundOpacity}%`,
    ...(showFlag && flagColor && { borderColor: flagColor }),
  };

  return (
    <div className={containerClassName} style={containerStyle}>
      {children}
    </div>
  );
};
FlagContour.displayName = 'FlagContour';
