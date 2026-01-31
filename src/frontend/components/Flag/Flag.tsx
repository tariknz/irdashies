import {
  useTelemetryValue,
  useDashboard,
  useSessionVisibility,
  useRunningState,
} from '@irdashies/context';
import { GlobalFlags } from '@irdashies/types';
import { useEffect, useState } from 'react';
import { useFlagSettings } from './hooks/useFlagSettings';
import { getDemoFlagData } from './demoData';

export const getFlagInfo = (sessionFlags: number) => {
/**
Flag Priority Hierarchy:
BLACK FLAG / FURLED (Absolute King – overrides even the finish line)
CHECKERED (The race is over)
RED (Session stopped)
DISQUALIFIED (You are removed from the session)
MEATBALL (Only if both Servicible and Repair bits are set)
YELLOW (Includes Waving, Caution, and CautionWaving)
GREEN (Includes StartGo and GreenHeld)
BLUE FLAG (Lapped traffic info)
DEBRIS (Track surface hazard)
WHITE (Final lap)
NO FLAG (Default state / Pits / Inactive) 
*/

  // 1. ABSOLUTE PRIORITY Too important in iracing to put any other flag above it
  if (sessionFlags & (GlobalFlags.Black | GlobalFlags.Furled)) {
    return { label: 'BLACK FLAG', color: 'bg-black text-white' };
  }

  // 2. CRITICAL SESSION STATUS
  if (sessionFlags & GlobalFlags.Checkered) return { label: 'CHECKERED', color: 'bg-white text-black' };
  if (sessionFlags & GlobalFlags.Red) return { label: 'RED', color: 'bg-red-600' };
  if (sessionFlags & GlobalFlags.Disqualify) return { label: 'DISQUALIFIED', color: 'bg-black text-red-600' };

  // 3. MECHANICAL / MEATBALL 
  const meatballMask = GlobalFlags.Servicible | GlobalFlags.Repair;
  if ((sessionFlags & meatballMask) === meatballMask) {
    return { label: 'MEATBALL', color: 'bg-orange-600' };
  }

  // 4. TRACK CAUTIONS
  if (sessionFlags & (GlobalFlags.Yellow | GlobalFlags.YellowWaving | GlobalFlags.Caution | GlobalFlags.CautionWaving)) {
    return { label: 'YELLOW', color: 'bg-yellow-400 text-black' };
  }

  // 5. RACING STATE
  if (sessionFlags & (GlobalFlags.Green | GlobalFlags.StartGo | GlobalFlags.GreenHeld)) {
    return { label: 'GREEN', color: 'bg-green-600' };
  }

  // 6. INFO FLAGS
  if (sessionFlags & GlobalFlags.Blue) return { label: 'BLUE FLAG', color: 'bg-blue-600' };
  if (sessionFlags & GlobalFlags.Debris) return { label: 'DEBRIS', color: 'bg-yellow-400' };
  if (sessionFlags & GlobalFlags.White) return { label: 'WHITE', color: 'bg-white text-black' };
  
  return { label: 'NO FLAG', color: 'bg-slate-500' };
};


export const Flag = () => {
  const { isDemoMode } = useDashboard();
  const { running } = useRunningState();
  const settings = useFlagSettings();
  
 const sessionFlags = useTelemetryValue<number>('SessionFlags') ?? 0;
 const isPlayerOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  
  // FIX: This hook calculates visibility based on the settings we pass in
  const isVisibleInSession = useSessionVisibility(settings.sessionVisibility);

  // Animation (blink) support: when animate is enabled, toggle between NO FLAG and the real flag every 500ms
  const [blinkOn, setBlinkOn] = useState(true);
  useEffect(() => {
    if (!settings.animate) return;
    const periodMs = (settings.blinkPeriod && settings.blinkPeriod > 0) ? Math.max(100, Math.floor(settings.blinkPeriod * 1000)) : 500;
    const id = setInterval(() => setBlinkOn((v) => !v), periodMs);
    return () => clearInterval(id);
  }, [settings.animate, settings.blinkPeriod]);

  // 1. Sidebar Master Switch
  if (!settings?.enabled) return null;

  // --- DEMO MODE ---
  if (isDemoMode) {
    const demo = getDemoFlagData();
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 99999, width: '100vw', height: '100vh' }}>
        <FlagDisplay label={demo.label} showLabel={settings.showLabel ?? true} matrixSize={settings.matrixMode === '8x8' ? 8 : settings.matrixMode === '16x16' ? 16 : 1} fullBleed />
      </div>
    );
  }

  // If the sim isn't running and demo mode is off, don't render the widget
  if (!running && !isDemoMode) return null;

  // --- VISIBILITY CHECKS ---

  // 2. Check if the current session allows this widget (calculated by the hook)
  if (!isVisibleInSession) return null;

  // 3. Check "On Track" setting
  if (settings.showOnlyWhenOnTrack && !isPlayerOnTrack) return null;

  // --- RENDER ---
  const flagInfo = getFlagInfo(sessionFlags);

  const visibleLabel = settings.animate && !blinkOn ? 'NO FLAG' : flagInfo.label;

  // 4. Hide widget if NO FLAG state is disabled and no flags are waved (apply to visible label)
  if (visibleLabel === 'NO FLAG' && !settings.showNoFlagState) return null;

  return <FlagDisplay label={visibleLabel} showLabel={settings.showLabel ?? true} matrixSize={settings.matrixMode === '8x8' ? 8 : settings.matrixMode === '16x16' ? 16 : 1} />;
};
export const FlagDisplay = ({ label, showLabel = true, textColor, matrixSize = 16, fullBleed = false }: { label: string; showLabel?: boolean; textColor?: string; matrixSize?: number; fullBleed?: boolean }) => {
  const isUniform = matrixSize === 1;
  const cols = isUniform ? 1 : matrixSize;
  const rows = isUniform ? 1 : matrixSize;
  const getLedColorHex = (flagType: string, row: number, col: number) => {
    // Colors (hex) chosen to match Tailwind-ish palette
    const GREEN = '#10B981'; // green-500
    const YELLOW = '#f5de0b'; // yellow-400-ish
    const BLUE = '#3B82F6'; // blue-500
    const RED = '#EF4444'; // red-500
    const WHITE = '#FFFFFF';
    const BLACK = '#000000';
    const ORANGE = '#F97316'; // orange-500
    const GREY = '#9CA3AF'; // slate-400
    const DARK = '#1f2937'; // slate-800

    // If the visible flag is NO, always render grey
    if (flagType === 'NO') return GREY;

    // If matrixSize is 1 we render a uniform colour across the full visual grid
    if (matrixSize === 1) {
      if (flagType === 'NO') return GREY; 
      if (flagType === 'CHECKERED') return WHITE;
      if (flagType === 'WHITE') return WHITE;
      if (flagType === 'BLACK') return BLACK;
      if (flagType === 'DISQUALIFIED') return BLACK;
      if (flagType === 'MEATBALL') return ORANGE; 
      if (flagType === 'GREEN') return GREEN;
      if (flagType === 'YELLOW') return YELLOW;
      if (flagType === 'BLUE') return BLUE;
      if (flagType === 'RED') return RED;
      if (flagType === 'DEBRIS') return YELLOW;
      return WHITE;
    }

    if (flagType === 'CHECKERED') {
      return ((row + col) % 2 === 0) ? WHITE : DARK;
    }

    if (flagType === 'WHITE') return WHITE;
    if (flagType === 'BLACK') return BLACK;

    if (flagType === 'MEATBALL') {
      // Draw a circular meatball centered in the matrix. Radius scales with matrix size.
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      // Radius scales with matrix width so 8x8 also shows a visible orange circle
      const radius = Math.max(1, Math.floor(cols * 0.3));
      const dx = col - cx;
      const dy = row - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) return ORANGE;
      return BLACK;
    }

    // Default colored flags
    if (flagType === 'GREEN') return GREEN;
    if (flagType === 'YELLOW') return YELLOW;
    if (flagType === 'BLUE') {
      const diagonalThreshold = cols - 1;
      const diagonalPos = col + row;
      // Create a stripe of about 2-3 cells thick
      if (Math.abs(diagonalPos - diagonalThreshold) <= 1) return YELLOW;
      return BLUE;
    }
    if (flagType === 'DEBRIS') {
      return (row % 2 === 0) ? RED : YELLOW;
    }
    if (flagType === 'DISQUALIFIED') {
      const diag1 = row - col;
      const diag2 = row + col - (cols - 1);
      if (Math.abs(diag1) <= 1 || Math.abs(diag2) <= 1) return WHITE;
      return BLACK;
    }
    if (flagType === 'RED') return RED;

    return WHITE;
  };
  const shortLabel = label.split(' ')[0];

  const getTextColorClass = () => {
    if (shortLabel === 'NO') return 'text-slate-500';
    if (shortLabel === 'GREEN') return 'text-green-500';
    if (shortLabel === 'YELLOW') return 'text-yellow-400';
    if (shortLabel === 'BLUE') return 'text-blue-500';
    if (shortLabel === 'RED') return 'text-red-500';
    if (shortLabel === 'WHITE') return 'text-white';
    if (shortLabel === 'MEATBALL') return 'text-orange-500';
    if (shortLabel === 'DEBRIS') return 'text-yellow-400';
    if (shortLabel === 'CHECKERED') return 'text-white';
    if (shortLabel === 'BLACK') return 'text-white';
    if (shortLabel === 'DISQUALIFIED') return 'text-red-500';
    return 'text-white';
  };

  const textColorClass = textColor ?? getTextColorClass();

  const flagType = shortLabel; // e.g., 'YELLOW', 'CHECKERED', 'MEATBALL', etc.

  const innerPadding = 6; // keep inner padding to show the border area
  const gap = isUniform ? 0 : 6;
  const cellRadius = isUniform ? 16 : 4;

  const outerClass = fullBleed
    ? 'flex flex-col items-stretch gap-0 bg-slate-900 border-4 border-slate-800 shadow-2xl'
    : 'flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl';

  const outerStyle: React.CSSProperties = fullBleed
    ? { width: '100%', height: '100%', boxSizing: 'border-box', margin: 0, padding: 0 }
    : { width: '100%' };

  return (
    <div className={outerClass} style={outerStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap,
          width: '100%',
          aspectRatio: `${cols} / ${rows}`,
          background: '#000000',
          padding: innerPadding,
          borderRadius: isUniform ? 20 : 12,
          boxSizing: 'border-box',
          height: fullBleed ? '100%' : undefined,
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const bg = getLedColorHex(flagType, row, col);
          // For uniform mode render a single cell that fills the area
          if (isUniform) {
            return (
              <div
                key="uniform"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: cellRadius,
                  boxSizing: 'border-box',
                  background: bg,
                }}
              />
            );
          }

          return (
            <div
              key={i}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: cellRadius,
                boxSizing: 'border-box',
                background: bg,
              }}
            />
          );
        })}
      </div>
      <div
        className="flex gap-2 items-center"
        style={{ minHeight: showLabel ? 24 : 0 }}
      >
        {showLabel && (
          <span
            className={`text-[14px] font-black px-3 py-1 uppercase rounded-md bg-black ${textColorClass} ${shortLabel === 'NO' ? 'opacity-0' : ''}`}
          >
            {shortLabel === 'NO' ? 'NO' : shortLabel}
          </span>
        )}
      </div>
    </div>
  );
};
