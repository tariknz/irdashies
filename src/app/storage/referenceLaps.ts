import { ReferenceLap, ReferencePoint } from '@irdashies/types';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

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
 * JSON Reviver: Converts arrays back to Maps for 'refPoints'
 */
const reviver = (key: string, value: unknown): unknown => {
  if (key === 'refPoints' && Array.isArray(value)) {
    // We cast to the specific tuple array expected by the Map constructor
    return new Map(value as [number, ReferencePoint][]);
  }
  return value;
};

/**
 * JSON Replacer: Converts Maps to arrays for storage
 */
const replacer = (key: string, value: unknown): unknown => {
  if (value instanceof Map) {
    return Array.from(value.entries());
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
    console.error('Failed to write reference lap data:', error);
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
