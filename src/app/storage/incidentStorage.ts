import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Incident } from '../../types/raceControl';

function getStorageDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  return path.join(app.getPath('userData'), 'incidents');
}

function getFilePath(sessionId: string, storageDir: string): string {
  return path.join(storageDir, `incidents-${sessionId}.json`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

// NOTE: This does a full-array rewrite rather than true append-only NDJSON for simplicity.
// For race sessions (hundreds of incidents), this is acceptable. If performance becomes
// an issue on very long endurance sessions, switch to NDJSON (one JSON object per line).
export function appendIncident(
  sessionId: string,
  incident: Incident,
  storageDir = getStorageDir()
) {
  ensureDir(storageDir);
  const filePath = getFilePath(sessionId, storageDir);
  const existing = loadIncidents(sessionId, storageDir);
  existing.push(incident);
  try {
    fs.writeFileSync(filePath, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to write incident file:', err);
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
      console.error('Failed to delete incident file:', err);
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
