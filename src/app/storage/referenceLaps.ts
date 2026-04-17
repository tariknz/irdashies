import { ReferenceLap } from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';

const dataPath = app.getPath('userData');
const filePath = path.join(dataPath, 'referenceLaps.json');

/**
 * Generates a unique composite key for storage.
 */
const generateKey = (
  seriesId: number,
  trackId: number,
  classId: number
): string => {
  return `${seriesId}_${trackId}_${classId}`;
};

/**
 * JSON Reviver: Converts arrays back to Float32Arrays for specific keys
 */
const reviver = (key: string, value: unknown): unknown => {
  if (
    (key === 'pointPos' || key === 'times' || key === 'tangents') &&
    Array.isArray(value)
  ) {
    return new Float32Array(value);
  }
  return value;
};

/**
 * JSON Replacer: Converts Float32Arrays to standard arrays for storage
 */
const replacer = (key: string, value: unknown): unknown => {
  if (value instanceof Float32Array) {
    return Array.from(value);
  }
  return value;
};

/**
 * Read all reference lap data from disk
 */
export const readReferenceLaps = (): Record<string, ReferenceLap> => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data, reviver);
  } catch {
    return {};
  }
};

/**
 * Write all reference lap data to disk
 */
export const writeReferenceLaps = (data: Record<string, ReferenceLap>) => {
  try {
    const jsonString = JSON.stringify(data, replacer, 2);
    fs.writeFileSync(filePath, jsonString);
  } catch (error) {
    logger.error('Failed to write reference lap data:', error);
  }
};

/**
 * Get reference lap for a specific combination
 */
export const getReferenceLap = (
  seriesId: number,
  trackId: number,
  classId: number
): ReferenceLap | null => {
  const allData = readReferenceLaps();
  const key = generateKey(seriesId, trackId, classId);
  return allData[key] || null;
};

/**
 * Save or update a reference lap for a specific combination
 */
export const saveReferenceLap = (
  seriesId: number,
  trackId: number,
  classId: number,
  lapData: ReferenceLap
) => {
  const allData = readReferenceLaps();
  const key = generateKey(seriesId, trackId, classId);

  allData[key] = lapData;

  writeReferenceLaps(allData);
};
