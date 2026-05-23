import { useMemo } from 'react';
import { useTelemetryValueRounded } from '@irdashies/context';
import type { LovelyTrackSection } from '@irdashies/types';
import { useLovelyTrackData } from './useLovelyTrackData';

interface CurrentSectionResult {
  section: LovelyTrackSection | null;
  progress: number; // 0-1 within the current section
}

/**
 * Determines the current track section from LapDistPct. Returns the matched
 * section and progress through it.
 */
export const useCurrentSection = (): CurrentSectionResult => {
  const { sections } = useLovelyTrackData();
  // 3dp ≈ 5m on a 5km track — matches SectorDelta precision
  const rawLapDistPct = useTelemetryValueRounded('LapDistPct', 3);

  return useMemo(() => {
    if (sections.length === 0 || rawLapDistPct == null) {
      return { section: null, progress: 0 };
    }

    // Normalize to [0, 1) — rounded telemetry can land exactly on 1.000.
    const lapDistPct = ((rawLapDistPct % 1) + 1) % 1;

    // Find the section containing the current lap distance
    const current = sections.find(
      (s) => lapDistPct >= s.start_pct && lapDistPct < s.end_pct
    );

    if (!current) {
      // Handle wrap-around (section spanning S/F line)
      const wrapping = sections.find(
        (s) =>
          s.end_pct < s.start_pct &&
          (lapDistPct >= s.start_pct || lapDistPct < s.end_pct)
      );
      if (wrapping) {
        const width =
          wrapping.end_pct < wrapping.start_pct
            ? 1 - wrapping.start_pct + wrapping.end_pct
            : wrapping.end_pct - wrapping.start_pct;
        const offset =
          lapDistPct >= wrapping.start_pct
            ? lapDistPct - wrapping.start_pct
            : 1 - wrapping.start_pct + lapDistPct;
        return {
          section: wrapping,
          progress: width > 0 ? Math.min(1, Math.max(0, offset / width)) : 0,
        };
      }
      return { section: null, progress: 0 };
    }

    const width = current.end_pct - current.start_pct;
    const offset = lapDistPct - current.start_pct;
    const progress = width > 0 ? Math.min(1, Math.max(0, offset / width)) : 0;

    return { section: current, progress };
  }, [sections, rawLapDistPct]);
};
