import type { DriverTagSettings } from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const getFilePath = () =>
  path.join(app.getPath('userData'), 'driver-tags.json');

const readSettingsFile = (filePath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
};

const readLegacyConfig = (): unknown => {
  const config = readSettingsFile(
    path.join(app.getPath('userData'), 'config.json')
  );
  if (config && typeof config === 'object' && 'driverTagSettings' in config) {
    return config.driverTagSettings;
  }
  return undefined;
};

/**
 * If a config was saved with widthPx set to the old tag-bar default (≤8px)
 * while displayStyle is 'badge', clear widthPx so the em-based default applies.
 */
const migrateWidthPx = (settings: DriverTagSettings): DriverTagSettings => {
  const display = settings.display;
  if (!display) return settings;
  const isBadge = !display.displayStyle || display.displayStyle === 'badge';
  if (isBadge && display.widthPx !== undefined && display.widthPx <= 8) {
    return {
      ...settings,
      display: { ...display, widthPx: undefined },
    };
  }
  return settings;
};

export const normalizeDriverTagSettings = (
  value: unknown
): DriverTagSettings | undefined => {
  if (
    !value ||
    typeof value !== 'object' ||
    !('groups' in value) ||
    !Array.isArray(value.groups)
  ) {
    return undefined;
  }
  const settings = value as DriverTagSettings;

  const mapping = settings.mapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return migrateWidthPx(settings);
  }
  const mappedDrivers = Object.entries(mapping);
  if (mappedDrivers.length === 0) return migrateWidthPx(settings);

  const entries = Array.isArray(settings.entries) ? [...settings.entries] : [];
  const assignedIds = new Set(entries.map((entry) => entry?.id));
  const assignedNames = new Set(
    entries.map((entry) =>
      typeof entry?.name === 'string' ? entry.name.toLowerCase() : undefined
    )
  );
  const legacyDrivers = new Map(
    mappedDrivers.map(([key, groupId]) => [key.toLowerCase(), { key, groupId }])
  );

  for (const [name, { key, groupId }] of legacyDrivers) {
    if (!key || typeof groupId !== 'string' || !groupId) continue;
    if (/^\d+$/.test(key)) {
      if (!assignedIds.has(key)) entries.push({ id: key, groupId });
    } else if (!assignedNames.has(name)) {
      entries.push({ name: key, groupId });
    }
  }

  return migrateWidthPx({ ...settings, entries, mapping: {} });
};

export const getDriverTagSettings = (): DriverTagSettings | undefined =>
  normalizeDriverTagSettings(readSettingsFile(getFilePath())) ??
  normalizeDriverTagSettings(readLegacyConfig());

export const saveDriverTagSettings = (settings: DriverTagSettings): void => {
  fs.writeFileSync(getFilePath(), JSON.stringify(settings));
};
