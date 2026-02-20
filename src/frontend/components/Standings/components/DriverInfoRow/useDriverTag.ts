import { useMemo, type ReactNode } from 'react';
import { getPresetTag } from '../../../../constants/driverTagBadges';
import type { DriverTagSettings } from '@irdashies/types';

export interface ResolvedDriverTag {
  id: string;
  name?: string;
  icon?: ReactNode | string | unknown;
  color?: number;
  /** Per-driver display label from the tag entry */
  label?: string;
}

export const useDriverTag = (
  rawKey: string | undefined,
  tagSettings?: DriverTagSettings,
  widgetTagEnabled?: boolean,
  skipWidgetTag = false,
  userId?: number
): ResolvedDriverTag | undefined => {
  // Create stable mapping: numeric ID keys stored as-is, name keys lower-cased
  const lcMapping = useMemo(() => {
    const map = new Map<string, string>();
    const m = tagSettings?.mapping;
    if (m) {
      for (const [k, v] of Object.entries(m)) {
        map.set(k.toLowerCase(), v);
      }
    }
    return map;
  }, [tagSettings?.mapping]);

  const groupsById = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name?: string; icon?: unknown; color?: number }
    >();
    const g = tagSettings?.groups;
    if (g) {
      for (const grp of g) {
        map.set(grp.id, grp);
      }
    }
    return map;
  }, [tagSettings?.groups]);

  return useMemo(() => {
    const presetOverrides = tagSettings?.presetOverrides ?? {};

    if (skipWidgetTag) return undefined;
    if (!tagSettings) return undefined;
    const displayEnabled = widgetTagEnabled ?? tagSettings.display?.enabled;
    if (!displayEnabled) return undefined;
    const key = (rawKey ?? '').trim();
    const idKey = userId != null ? String(userId) : undefined;

    // Check entries first: ID priority, then name
    let groupId: string | undefined;
    let entryLabel: string | undefined;
    const entries = tagSettings.entries ?? [];
    if (idKey) {
      const match = entries.find((e) => e.id === idKey);
      if (match) {
        groupId = match.groupId;
        entryLabel = match.label;
      }
    }
    if (!groupId && key) {
      const match = entries.find(
        (e) => e.name && e.name.toLowerCase() === key.toLowerCase()
      );
      if (match) {
        groupId = match.groupId;
        entryLabel = match.label;
      }
    }
    // Fall back to legacy mapping (no label support)
    if (!groupId) {
      groupId =
        (idKey ? lcMapping.get(idKey) : undefined) ??
        (key ? lcMapping.get(key.toLowerCase()) : undefined);
    }
    if (!groupId) return undefined;

    const custom = groupsById.get(groupId);
    if (custom)
      return {
        id: custom.id,
        name: custom.name,
        icon: custom.icon,
        color: custom.color,
        label: entryLabel,
      };

    const presetOverride = presetOverrides[groupId];
    const preset = getPresetTag(groupId);
    if (presetOverride)
      return {
        id: groupId,
        name: presetOverride.name ?? preset?.name,
        icon: presetOverride.icon ?? preset?.icon,
        color: presetOverride.color ?? preset?.color,
        label: entryLabel,
      };
    if (preset) return { ...preset, label: entryLabel };
    return undefined;
  }, [
    rawKey,
    widgetTagEnabled,
    skipWidgetTag,
    lcMapping,
    groupsById,
    tagSettings,
    userId,
  ]);
};

export default useDriverTag;
