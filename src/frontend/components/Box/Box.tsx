import { ReactNode } from 'react';

export interface BoxProps {
  children: ReactNode;
  className?: string;
  background?: {
    opacity: number; // 0-100
  };
}

export const Box = ({ children, className = '', background }: BoxProps) => {
  return (
    <div
      className={`bg-slate-800/(--bg-opacity) rounded-sm border-2 border-slate-600/50 transition-all duration-300 overflow-hidden ${className}`}
      style={
        {
          '--bg-opacity': background ? `${background.opacity}%` : '85%',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};
