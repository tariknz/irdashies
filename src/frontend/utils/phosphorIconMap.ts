import * as PhosphorIcons from '@phosphor-icons/react';
import { icons as coreIcons } from '@phosphor-icons/core';
import type { ElementType } from 'react';

export interface PhosphorIconEntry {
  name: string;
  component: ElementType;
  tags: readonly string[];
}

// Build a lookup from pascal_name → tags using the core metadata package.
const coreTagMap = new Map<string, readonly string[]>(
  coreIcons.map((entry) => [entry.pascal_name, entry.tags])
);

// Enumerate all Phosphor icon components at module load time.
export const PHOSPHOR_ICON_ENTRIES: PhosphorIconEntry[] = Object.entries(
  PhosphorIcons as Record<string, unknown>
)
  .filter(
    ([k, v]) =>
      k.endsWith('Icon') &&
      k.length > 4 &&
      (typeof v === 'function' || (typeof v === 'object' && v !== null))
  )
  .map(([k, v]) => ({
    name: k.slice(0, -4),
    component: v as ElementType,
    tags: coreTagMap.get(k.slice(0, -4)) ?? [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// O(1) lookup by display name (e.g. "Car" → CarIcon component).
// Also handles the case where a caller passes "CarIcon" instead of "Car".
export const PHOSPHOR_ICON_MAP = new Map<string, ElementType>(
  PHOSPHOR_ICON_ENTRIES.map(({ name, component }) => [name, component])
);
