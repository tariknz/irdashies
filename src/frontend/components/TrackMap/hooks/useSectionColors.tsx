import { useMemo } from 'react';
import { useSessionStore } from '@irdashies/context';

// Contrasting colors for sections - ensure adjacent sections (including first/last) get different colors
const SECTION_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#6366f1', // indigo
];

const assignSectionColors = (numSections: number): string[] => {
  if (numSections <= 0) return [];
  if (numSections === 1) return [SECTION_COLORS[0]];

  const colors: string[] = [];
  for (let i = 0; i < numSections; i++) {
    const prev = colors[colors.length - 1];
    // For the last section, also avoid matching the first color (wrap-around)
    const first = i === numSections - 1 ? colors[0] : undefined;

    let idx = i % SECTION_COLORS.length;
    while (SECTION_COLORS[idx] === prev || SECTION_COLORS[idx] === first) {
      idx = (idx + 1) % SECTION_COLORS.length;
    }
    colors.push(SECTION_COLORS[idx]);
  }
  return colors;
};

export const useSectionColors = (enabled: boolean) => {
  // Get sector boundaries from session data (SplitTimeInfo contains Sectors array with SectorStartPct)
  const session = useSessionStore((state) => state.session);

  const { sectionBoundaries, colors } = useMemo(() => {
    if (!enabled || !session) {
      return { sectionBoundaries: null, colors: null };
    }

    try {
      const splitTimeInfo = session.SplitTimeInfo;
      if (!splitTimeInfo?.Sectors || splitTimeInfo.Sectors.length === 0) {
        return { sectionBoundaries: null, colors: null };
      }

      const sectors = splitTimeInfo.Sectors;

      // Build boundaries: [0, start1, start2, ..., 1]
      // Sort by SectorStartPct to ensure correct order
      const sortedSectors = [...sectors].sort(
        (a, b) => a.SectorStartPct - b.SectorStartPct
      );
      const rawBoundaries = [
        0,
        ...sortedSectors.map((s) => s.SectorStartPct),
        1,
      ];
      const boundaries = rawBoundaries.filter(
        (val, idx, arr) => idx === 0 || val !== arr[idx - 1]
      );

      const numSections = boundaries.length - 1;
      if (numSections <= 0) {
        return { sectionBoundaries: null, colors: null };
      }

      return {
        sectionBoundaries: boundaries,
        colors: assignSectionColors(numSections),
      };
    } catch {
      return { sectionBoundaries: null, colors: null };
    }
  }, [enabled, session]);

  return {
    sectionBoundaries,
    colors,
    numSections: sectionBoundaries?.length ? sectionBoundaries.length - 1 : 0,
  };
};
