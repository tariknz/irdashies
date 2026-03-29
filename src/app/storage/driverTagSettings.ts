import type { DriverTagSettings } from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const getFilePath = () =>
  path.join(app.getPath('userData'), 'driver-tags.json');

const migrateFromConfig = (): DriverTagSettings | undefined => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    if (!config.driverTagSettings) return undefined;
    const settings = config.driverTagSettings as DriverTagSettings;
    fs.writeFileSync(getFilePath(), JSON.stringify(settings));
    delete config.driverTagSettings;
    fs.writeFileSync(configPath, JSON.stringify(config));
    return settings;
  } catch {
    return undefined;
  }
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
    const migrated = {
      ...settings,
      display: { ...display, widthPx: undefined },
    };
    saveDriverTagSettings(migrated);
    return migrated;
  }
  return settings;
};

export const getDriverTagSettings = (): DriverTagSettings | undefined => {
  try {
    const data = fs.readFileSync(getFilePath(), 'utf8');
    const settings = JSON.parse(data) as DriverTagSettings;
    return migrateWidthPx(settings);
  } catch {
    return migrateFromConfig();
  }
};

export const saveDriverTagSettings = (settings: DriverTagSettings): void => {
  fs.writeFileSync(getFilePath(), JSON.stringify(settings));
};
