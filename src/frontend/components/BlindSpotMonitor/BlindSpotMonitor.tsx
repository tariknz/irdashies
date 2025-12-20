import { useMemo } from 'react';
import { useBlindSpotMonitor } from './hooks/useBlindSpotMonitor';
import { useBlindSpotMonitorSettings } from './hooks/useBlindSpotMonitorSettings';

const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

interface IndicatorProps {
  side: 'left' | 'right';
  lineWidth: number;
  bgWidth?: number;
  lineColor: string;
  lineOpacity: number;
  bgColor?: string;
  bgOpacity?: number;
  percent: number;
  state: number;
}

const Indicator = ({
  side,
  lineWidth,
  bgWidth,
  lineColor,
  lineOpacity,
  bgColor,
  bgOpacity,
  percent,
  state,
}: IndicatorProps) => {
  const fillPercent = Math.max(0, Math.min(1, (percent + 1) / 2));
  const lineRgba = hexToRgba(lineColor, lineOpacity);
  const containerWidth = Math.max(lineWidth, bgWidth || 0);

  const fillBackground =
    state === 2
      ? `linear-gradient(to top, ${lineRgba} 0%, ${lineRgba} 12%, transparent 12%, transparent 18%, ${lineRgba} 18%, ${lineRgba} 30%, transparent 30%)`
      : lineRgba;

  return (
    <div
      className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{ width: containerWidth }}
    >
      {bgColor && bgOpacity && bgWidth && (
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            width: bgWidth,
            [side === 'left' ? 'left' : 'right']: 0,
            backgroundColor: hexToRgba(bgColor, bgOpacity),
          }}
        />
      )}
      <div
        className="absolute bottom-0 rounded-full"
        style={{
          width: lineWidth,
          height: '100%',
          [side === 'left' ? 'left' : 'right']: 0,
          background: fillBackground,
          transform: `scaleY(${fillPercent})`,
          transformOrigin: 'bottom',
        }}
      />
    </div>
  );
};

export interface BlindSpotMonitorDisplayProps {
  show: boolean;
  leftState: number;
  rightState: number;
  leftPercent: number;
  rightPercent: number;
  settings: {
    lineColor: string;
    lineOpacity: number;
    lineWidth: number;
    bgColor?: string;
    bgOpacity?: number;
    bgWidth?: number;
    distAhead: number;
    distBehind: number;
  };
}

export const BlindSpotMonitorDisplay = ({
  show,
  leftState,
  rightState,
  leftPercent,
  rightPercent,
  settings,
}: BlindSpotMonitorDisplayProps) => {
  if (!show) {
    return null;
  }

  return (
    <div className="w-full h-full relative">
      {leftState > 0 && (
        <Indicator
          side="left"
          lineWidth={settings.lineWidth}
          bgWidth={settings.bgWidth}
          lineColor={settings.lineColor}
          lineOpacity={settings.lineOpacity}
          bgColor={settings.bgColor}
          bgOpacity={settings.bgOpacity}
          percent={leftPercent}
          state={leftState}
        />
      )}
      {rightState > 0 && (
        <Indicator
          side="right"
          lineWidth={settings.lineWidth}
          bgWidth={settings.bgWidth}
          lineColor={settings.lineColor}
          lineOpacity={settings.lineOpacity}
          bgColor={settings.bgColor}
          bgOpacity={settings.bgOpacity}
          percent={rightPercent}
          state={rightState}
        />
      )}
    </div>
  );
};

export const BlindSpotMonitor = () => {
  const state = useBlindSpotMonitor();
  const settings = useBlindSpotMonitorSettings();

  const defaultSettings = useMemo(
    () => ({
      lineColor: '#F59E0B',
      lineOpacity: 100,
      lineWidth: 5,
      bgColor: undefined,
      bgOpacity: undefined,
      bgWidth: undefined,
      distAhead: 4,
      distBehind: 4,
    }),
    []
  );

  const effectiveSettings = settings || defaultSettings;

  return (
    <BlindSpotMonitorDisplay
      show={state.show}
      leftState={state.leftState}
      rightState={state.rightState}
      leftPercent={state.leftPercent}
      rightPercent={state.rightPercent}
      settings={effectiveSettings}
    />
  );
};

