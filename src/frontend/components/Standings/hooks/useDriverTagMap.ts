import { useMemo, type ReactNode } from 'react';
import { useDashboard, useSessionStore } from '@irdashies/context';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { getPresetTag } from '../../../constants/driverTagBadges';
import type {
  DriverTagEntry,
  DriverTagSettings,
  TagGroup,
} from '@irdashies/types';

export interface ResolvedDriverTag {
  id: string;
  name?: string;
  icon?: ReactNode | string | unknown;
  color?: number;
  /** Per-driver display label from the tag entry */
  label?: string;
}

interface DriverIdentity {
  CarIdx: number;
  UserID: number;
  UserName: string;
}

const driversIdentityEqual = (
  a: DriverIdentity[] | undefined,
  b: DriverIdentity[] | undefined
): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (d, i) =>
      d.CarIdx === b[i].CarIdx &&
      d.UserID === b[i].UserID &&
      d.UserName === b[i].UserName
  );
};

const resolveTag = (
  userId: string | undefined,
  name: string,
  entries: DriverTagEntry[],
  fallbackEntries: Map<string, DriverTagEntry>,
  groupsById: Map<string, TagGroup>,
  presetOverrides: DriverTagSettings['presetOverrides']
): ResolvedDriverTag | undefined => {
  const nameLower = name.toLowerCase();
  const match =
    (userId ? entries.find((entry) => entry.id === userId) : undefined) ??
    (nameLower
      ? entries.find((entry) => entry.name?.toLowerCase() === nameLower)
      : undefined) ??
    (userId ? fallbackEntries.get(userId) : undefined) ??
    (nameLower ? fallbackEntries.get(nameLower) : undefined);
  if (!match) return undefined;
  const { groupId, label } = match;

  const custom = groupsById.get(groupId);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      icon: custom.icon,
      color: custom.color,
      label,
    };
  }

  const preset = getPresetTag(groupId);
  const override = presetOverrides?.[groupId];
  if (override) {
    return {
      id: groupId,
      name: override.name ?? preset?.name,
      icon: override.icon ?? preset?.icon,
      color: override.color ?? preset?.color,
      label,
    };
  }
  if (preset) return { ...preset, label };
  return undefined;
};

export interface DriverTagMapResult {
  tagMap: Map<number, ResolvedDriverTag>;
  hasAnyTag: boolean;
}

/**
 * Pre-computes driver tag assignments for all drivers in the current session.
 * Only recomputes when the driver roster (identity) or tag settings change.
 * Call once at the parent level and pass resolved tags down to each row.
 */
export const useDriverTagMap = (
  widgetTagEnabled?: boolean
): DriverTagMapResult => {
  const { currentDashboard } = useDashboard();
  const tagSettings = currentDashboard?.generalSettings?.driverTagSettings;

  const drivers = useStoreWithEqualityFn(
    useSessionStore,
    (state) => state.session?.DriverInfo?.Drivers,
    driversIdentityEqual
  );

  return useMemo(() => {
    const empty: DriverTagMapResult = { tagMap: new Map(), hasAnyTag: false };
    if (!tagSettings || !drivers) return empty;

    if (!widgetTagEnabled) return empty;

    const fallbackEntries = new Map<string, DriverTagEntry>();
    for (const [key, groupId] of Object.entries(tagSettings.mapping ?? {})) {
      fallbackEntries.set(key.toLowerCase(), { groupId });
    }
    const entries: DriverTagEntry[] = [];
    for (const entry of tagSettings.entries ?? []) {
      if (entry.legacyMapping) {
        if (entry.id) fallbackEntries.set(entry.id, entry);
        if (entry.name) fallbackEntries.set(entry.name.toLowerCase(), entry);
      } else {
        entries.push(entry);
      }
    }
    const groupsById = new Map(
      (tagSettings.groups ?? []).map((g) => [g.id, g])
    );

    const tagMap = new Map<number, ResolvedDriverTag>();
    for (const driver of drivers) {
      const userId = driver.UserID != null ? String(driver.UserID) : undefined;
      const name = String(driver.UserName ?? '').trim();
      const tag = resolveTag(
        userId,
        name,
        entries,
        fallbackEntries,
        groupsById,
        tagSettings.presetOverrides
      );
      if (tag) tagMap.set(driver.CarIdx, tag);
    }

    return { tagMap, hasAnyTag: tagMap.size > 0 };
  }, [tagSettings, drivers, widgetTagEnabled]);
};
