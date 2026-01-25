import { useMemo, type ReactNode } from 'react';
import { getPresetTag } from '../../../../constants/driverTagBadges';
import type { DriverTagSettings } from '@irdashies/types';

export interface ResolvedDriverTag {
  id: string;
  name?: string;
  icon?: ReactNode | string | unknown;
  color?: number;
}

export const useDriverTag = (
  rawKey: string | undefined,
  tagSettings?: DriverTagSettings,
  widgetTagEnabled?: boolean,
  skipWidgetTag = false,
): ResolvedDriverTag | undefined => {
  // Create stable lower-cased mapping and group lookup to avoid expensive finds on every render
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
    const map = new Map<string, { id: string; name?: string; icon?: unknown; color?: number }>();
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
    if (!key) return undefined;
    const groupId = lcMapping.get(key.toLowerCase());
    if (!groupId) return undefined;

    const custom = groupsById.get(groupId);
    if (custom) return { id: custom.id, name: custom.name, icon: custom.icon, color: custom.color };

    const presetOverride = presetOverrides[groupId];
    const preset = getPresetTag(groupId);
    if (presetOverride) return { id: groupId, name: presetOverride.name ?? preset?.name, icon: presetOverride.icon ?? preset?.icon, color: presetOverride.color ?? preset?.color };
    if (preset) return preset;
    return undefined;
  }, [rawKey, widgetTagEnabled, skipWidgetTag, lcMapping, groupsById, tagSettings]);
};

export default useDriverTag;
