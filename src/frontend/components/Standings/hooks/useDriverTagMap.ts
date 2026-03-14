import { useMemo } from 'react';
import { useDashboard, useSessionStore } from '@irdashies/context';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { getPresetTag } from '../../../constants/driverTagBadges';
import type { DriverTagSettings } from '@irdashies/types';
import type { ResolvedDriverTag } from '../components/DriverInfoRow/useDriverTag';

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
  tagSettings: DriverTagSettings
): ResolvedDriverTag | undefined => {
  const entries = tagSettings.entries ?? [];
  const mapping = tagSettings.mapping ?? {};
  const presetOverrides = tagSettings.presetOverrides ?? {};
  const groups = tagSettings.groups ?? [];

  const lcMapping = new Map<string, string>();
  for (const [k, v] of Object.entries(mapping)) {
    lcMapping.set(k.toLowerCase(), v);
  }
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  let groupId: string | undefined;
  let entryLabel: string | undefined;

  if (userId) {
    const match = entries.find((e) => e.id === userId);
    if (match) {
      groupId = match.groupId;
      entryLabel = match.label;
    }
  }
  if (!groupId && name) {
    const nameLower = name.toLowerCase();
    const match = entries.find(
      (e) => e.name && e.name.toLowerCase() === nameLower
    );
    if (match) {
      groupId = match.groupId;
      entryLabel = match.label;
    }
  }
  if (!groupId) {
    groupId =
      (userId ? lcMapping.get(userId) : undefined) ??
      (name ? lcMapping.get(name.toLowerCase()) : undefined);
  }

  if (!groupId) return undefined;

  const custom = groupsById.get(groupId);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      icon: custom.icon,
      color: custom.color,
      label: entryLabel,
    };
  }

  const preset = getPresetTag(groupId);
  const override = presetOverrides[groupId];
  if (override) {
    return {
      id: groupId,
      name: override.name ?? preset?.name,
      icon: override.icon ?? preset?.icon,
      color: override.color ?? preset?.color,
      label: entryLabel,
    };
  }
  if (preset) return { ...preset, label: entryLabel };
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

    const tagMap = new Map<number, ResolvedDriverTag>();
    for (const driver of drivers) {
      const userId = driver.UserID != null ? String(driver.UserID) : undefined;
      const name = (driver.UserName ?? '').trim();
      const tag = resolveTag(userId, name, tagSettings);
      if (tag) tagMap.set(driver.CarIdx, tag);
    }

    return { tagMap, hasAnyTag: tagMap.size > 0 };
  }, [tagSettings, drivers, widgetTagEnabled]);
};
