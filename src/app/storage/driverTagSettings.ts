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

export const getDriverTagSettings = (): DriverTagSettings | undefined => {
  try {
    const data = fs.readFileSync(getFilePath(), 'utf8');
    return JSON.parse(data) as DriverTagSettings;
  } catch {
    return migrateFromConfig();
  }
};

export const saveDriverTagSettings = (settings: DriverTagSettings): void => {
  fs.writeFileSync(getFilePath(), JSON.stringify(settings));
};
