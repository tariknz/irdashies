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

      // Assign colors ensuring adjacent sections (including wrap-around) differ
      const numSections = boundaries.length - 1;
      if (numSections <= 0) {
        return { sectionBoundaries: null, colors: null };
      }

      const assignedColors: string[] = [];

      for (let i = 0; i < numSections; i++) {
        let colorIndex = i;

        // Skip colors that would match the previous section
        while (
          assignedColors.length > 0 &&
          assignedColors[assignedColors.length - 1] ===
            SECTION_COLORS[colorIndex % SECTION_COLORS.length]
        ) {
          colorIndex++;
        }

        assignedColors.push(SECTION_COLORS[colorIndex % SECTION_COLORS.length]);
      }

      // Ensure first and last sections have different colors
      if (
        assignedColors.length > 1 &&
        assignedColors[0] === assignedColors[assignedColors.length - 1]
      ) {
        const currentLast = assignedColors[assignedColors.length - 1];
        if (currentLast !== undefined) {
          assignedColors.pop();
          let newIndex = SECTION_COLORS.indexOf(currentLast);
          do {
            newIndex = (newIndex + 1) % SECTION_COLORS.length;
          } while (
            assignedColors.length > 0 &&
            SECTION_COLORS[newIndex] ===
              assignedColors[assignedColors.length - 1]
          );
          assignedColors.push(SECTION_COLORS[newIndex]);
        }
      }

      return { sectionBoundaries: boundaries, colors: assignedColors };
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
