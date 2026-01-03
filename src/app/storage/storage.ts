import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const dataPath = app.getPath('userData');
const filePath = path.join(dataPath, 'config.json');

export const writeData = (key: string, value: unknown) => {
  const contents = parseData();
  contents[key] = value;
  fs.writeFileSync(filePath, JSON.stringify(contents));
};

export const readData = <T>(key: string): T | undefined => {
  const contents = parseData();
  return contents[key] as T;
};

const parseData = () => {
  const defaultData = {};
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to read config file', error);
    console.warn('Creating new config file');
    return defaultData;
  }
};
