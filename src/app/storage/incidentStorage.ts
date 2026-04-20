import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { Incident } from '../../types/raceControl';
import logger from '../logger';

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return path.join(app.getPath('userData'), 'incidents');
}

function getFilePath(sessionId: string, storageDir: string): string {
  return path.join(storageDir, `incidents-${sessionId}.json`);
}

export function loadIncidents(
  sessionId: string,
  storageDir = getStorageDir()
): Incident[] {
  const filePath = getFilePath(sessionId, storageDir);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Incident[];
  } catch {
    return [];
  }
}

export async function appendIncident(
  sessionId: string,
  incident: Incident,
  storageDir = getStorageDir()
): Promise<void> {
  await fsp.mkdir(storageDir, { recursive: true });
  const filePath = getFilePath(sessionId, storageDir);
  const existing = loadIncidents(sessionId, storageDir);
  existing.push(incident);
  try {
    await fsp.writeFile(filePath, JSON.stringify(existing));
  } catch (err) {
    logger.error('Failed to write incident file:', err);
  }
}

export function clearIncidents(
  sessionId: string,
  storageDir = getStorageDir()
) {
  const filePath = getFilePath(sessionId, storageDir);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.error('Failed to delete incident file:', err);
    }
  }
}

export function listSessionFiles(storageDir = getStorageDir()): string[] {
  if (!fs.existsSync(storageDir)) return [];
  return fs
    .readdirSync(storageDir)
    .filter((f) => f.startsWith('incidents-') && f.endsWith('.json'))
    .map((f) => path.join(storageDir, f))
    .map((fullPath) => ({ fullPath, mtime: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime)
    .map(({ fullPath }) => fullPath);
}

export function pruneOldSessions(
  retention: 'all' | 5 | 10 | 20,
  storageDir = getStorageDir()
) {
  if (retention === 'all') return;
  const files = listSessionFiles(storageDir);
  const toDelete = files.slice(0, Math.max(0, files.length - retention));
  toDelete.forEach((f) => fs.unlinkSync(f));
}
