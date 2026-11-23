import type {
  DriverTagEntry,
  DriverTagSettings,
  TagGroup,
} from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const getFilePath = () =>
  path.join(app.getPath('userData'), 'driver-tags.json');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

const readNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readGroupFields = (
  value: Record<string, unknown>
): Partial<TagGroup> => ({
  id: readString(value.id),
  name: readString(value.name),
  color: readNumber(value.color),
  icon: readString(value.icon),
});

const readGroup = (value: unknown): TagGroup | undefined => {
  if (!isRecord(value)) return undefined;
  const { id, name, color, icon } = readGroupFields(value);
  return id && name !== undefined && color !== undefined
    ? { id, name, color, icon }
    : undefined;
};

const readEntry = (value: unknown): DriverTagEntry | undefined => {
  if (!isRecord(value) || typeof value.groupId !== 'string' || !value.groupId) {
    return undefined;
  }
  return {
    id: readString(value.id),
    name: readString(value.name),
    label: readString(value.label),
    groupId: value.groupId,
  };
};

const readDisplay = (value: unknown): DriverTagSettings['display'] => {
  if (!isRecord(value)) return { enabled: false };
  const { displayStyle, iconWeight, nameDisplay } = value;
  const widthPx = readNumber(value.widthPx);
  const alternateFrequency = readNumber(value.alternateFrequency);
  return {
    enabled: value.enabled === true,
    displayStyle:
      displayStyle === 'badge' || displayStyle === 'tag'
        ? displayStyle
        : undefined,
    widthPx:
      displayStyle === 'tag' || (widthPx !== undefined && widthPx > 8)
        ? widthPx
        : undefined,
    iconWeight:
      iconWeight === 'fill' || iconWeight === 'regular'
        ? iconWeight
        : undefined,
    nameDisplay:
      nameDisplay === 'both' ||
      nameDisplay === 'label' ||
      nameDisplay === 'name'
        ? nameDisplay
        : undefined,
    alternateFrequency:
      alternateFrequency !== undefined &&
      alternateFrequency >= 2 &&
      alternateFrequency <= 60
        ? alternateFrequency
        : undefined,
  };
};

export const normalizeDriverTagSettings = (
  value: unknown
): DriverTagSettings | undefined => {
  if (!isRecord(value)) return undefined;
  const { groups, entries, presetOverrides, display } = value;
  if (!Array.isArray(groups) && !Array.isArray(entries)) {
    return undefined;
  }

  return {
    groups: Array.isArray(groups)
      ? groups.map(readGroup).filter((group) => group !== undefined)
      : [],
    entries: Array.isArray(entries)
      ? entries.map(readEntry).filter((entry) => entry !== undefined)
      : [],
    display: readDisplay(display),
    presetOverrides: isRecord(presetOverrides)
      ? Object.fromEntries(
          Object.entries(presetOverrides).flatMap(([key, override]) =>
            isRecord(override) ? [[key, readGroupFields(override)]] : []
          )
        )
      : undefined,
  };
};

export const getDriverTagSettings = (): DriverTagSettings | undefined => {
  try {
    return normalizeDriverTagSettings(
      JSON.parse(fs.readFileSync(getFilePath(), 'utf8'))
    );
  } catch {
    return undefined;
  }
};

export const saveDriverTagSettings = (settings: DriverTagSettings): void => {
  fs.writeFileSync(getFilePath(), JSON.stringify(settings));
};
