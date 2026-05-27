import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';

const dataPath = app.getPath('userData');
const FILEPATH = path.join(dataPath, 'config.json');

export const writeData = (
  key: string,
  value: unknown,
  filePath: string = FILEPATH
) => {
  const contents = parseData(filePath);
  contents[key] = value;
  fs.writeFileSync(filePath, JSON.stringify(contents));
};

export const readData = <T>(
  key: string,
  filePath: string = FILEPATH
): T | undefined => {
  const contents = parseData(filePath);
  return contents[key] as T;
};

const parseData = (filePath: string) => {
  const defaultData = {};
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Failed to read config file', error);
    logger.warn('Creating new config file');
    return defaultData;
  }
};
