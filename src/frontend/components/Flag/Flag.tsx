import {
  useTelemetryValue,
  useDashboard,
  useSessionVisibility, // Use this for the logic
  useRunningState,
} from '@irdashies/context';
import { useFlagSettings } from './hooks/useFlagSettings';
import { getDemoFlagData } from './demoData';

const FLAG_STATES = {
  CHECKERED: 0x00000001,
  WHITE: 0x00000002,
  GREEN: 0x00000004,
  YELLOW: 0x00000008,
  RED: 0x00000010,
  BLUE: 0x00000020,
  DEBRIS: 0x00000040,
  BLACK: 0x010000,
  SERVICIBLE: 0x040000,
};

const getFlagInfo = (sessionFlags: number) => {
  if (sessionFlags & FLAG_STATES.RED) return { label: 'RED FLAG', color: 'bg-red-600' };
  if (sessionFlags & FLAG_STATES.CHECKERED) return { label: 'CHECKERED', color: 'bg-white' };
  if (sessionFlags & FLAG_STATES.BLACK) return { label: 'BLACK FLAG', color: 'bg-black' };
  if (sessionFlags & FLAG_STATES.SERVICIBLE) return { label: 'MEATBALL', color: 'bg-orange-600' };
  if (sessionFlags & FLAG_STATES.BLUE) return { label: 'BLUE FLAG', color: 'bg-blue-600' };
  if (sessionFlags & FLAG_STATES.YELLOW) return { label: 'YELLOW', color: 'bg-yellow-400' };
  return { label: 'NO FLAG', color: 'bg-slate-500' };
};

export const Flag = () => {
  const { isDemoMode } = useDashboard();
  const { running } = useRunningState();
  const settings = useFlagSettings();
  
  // High-speed telemetry
  const sessionFlags = useTelemetryValue<number>('SessionFlags') ?? 0;
  // Force it to show even if the sim isn't running
const isPlayerOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? true; // Default to true for testing
  
  // FIX: This hook calculates visibility based on the settings we pass in
  const isVisibleInSession = useSessionVisibility(settings.sessionVisibility);

  // 1. Sidebar Master Switch
  if (!settings?.enabled) return null;

  // --- DEMO MODE ---
  if (isDemoMode) {
    const demo = getDemoFlagData();
    return (
      <div style={{ position: 'fixed', top: '100px', left: '100px', zIndex: 99999 }}>
        <FlagDisplay label={demo.label} showLabel={settings.showLabel ?? true} />
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
  
  // 4. Hide widget if NO FLAG state is disabled and no flags are waved
  if (flagInfo.label === 'NO FLAG' && !settings.showNoFlagState) return null;
  
  return <FlagDisplay label={flagInfo.label} showLabel={settings.showLabel ?? true} />;
};

export const FlagDisplay = ({ label, showLabel = true, textColor }: { label: string; showLabel?: boolean; textColor?: string }) => {
  const getLedColorHex = (flagType: string, row: number, col: number) => {
    // Colors (hex) chosen to match Tailwind-ish palette
    const GREEN = '#10B981'; // green-500
    const YELLOW = '#F59E0B'; // yellow-400-ish
    const BLUE = '#3B82F6'; // blue-500
    const RED = '#EF4444'; // red-500
    const WHITE = '#FFFFFF';
    const BLACK = '#000000';
    const ORANGE = '#F97316'; // orange-500
    const GREY = '#9CA3AF'; // slate-400
    const DARK = '#1f2937'; // slate-800

    if (flagType === 'NO') return GREY;  // NO FLAG = all grey

    if (flagType === 'CHECKERED') {
      return ((row + col) % 2 === 0) ? WHITE : DARK;
    }

    if (flagType === 'WHITE') return WHITE;
    if (flagType === 'BLACK') return BLACK;

    if (flagType === 'MEATBALL') {
      // 4x4 center 'ball' for visibility: center rows/cols for 16x16 grid are 7 and 8
      if ((row === 7 || row === 8) && (col === 7 || col === 8)) return ORANGE;
      return BLACK;
    }

    // Default colored flags
    if (flagType === 'GREEN') return GREEN;
    if (flagType === 'YELLOW') return YELLOW;
    if (flagType === 'BLUE') return BLUE;
    if (flagType === 'RED') return RED;

    return WHITE;
  };
  const cols = 16;
  const rows = 16;
  const shortLabel = label.split(' ')[0];

  const getTextColorClass = () => {
    if (shortLabel === 'NO') return 'text-slate-500';
    if (shortLabel === 'GREEN') return 'text-green-500';
    if (shortLabel === 'YELLOW') return 'text-yellow-400';
    if (shortLabel === 'BLUE') return 'text-blue-500';
    if (shortLabel === 'RED') return 'text-red-500';
    if (shortLabel === 'WHITE') return 'text-white';
    if (shortLabel === 'MEATBALL') return 'text-orange-500';
    if (shortLabel === 'CHECKERED') return 'text-white';
    if (shortLabel === 'BLACK') return 'text-white';
    return 'text-white';
  };

  const textColorClass = textColor ?? getTextColorClass();

  const flagType = shortLabel; // e.g., 'YELLOW', 'CHECKERED', 'MEATBALL', etc.

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-900 rounded-xl border-4 border-slate-800 shadow-2xl h-full w-full">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 6,
          width: '100%',
          aspectRatio: `${cols} / ${rows}`,
          background: '#000000',
          padding: 6,
          borderRadius: 6,
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const bg = getLedColorHex(flagType, row, col);
          return (
            <div
              key={i}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 4,
                boxSizing: 'border-box',
                background: bg,
              }}
            />
          );
        })}
      </div>
      <div className="flex gap-2">
        {showLabel && shortLabel !== 'NO' && (
          <span className={`text-[10px] font-black px-2 uppercase rounded bg-black ${textColorClass}`}>
            {shortLabel}
          </span>
        )}
      </div>
    </div>
  );
};
