import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import type { TrackNote } from '@irdashies/types';

const filePath = () => path.join(app.getPath('userData'), 'track-notes.json');
let saveQueue: Promise<void> = Promise.resolve();

export async function loadTrackNotes(): Promise<TrackNote[]> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(filePath(), 'utf8'));
    return Array.isArray(value) ? (value as TrackNote[]) : [];
  } catch {
    return [];
  }
}

export function saveTrackNotes(notes: TrackNote[]): Promise<void> {
  const destination = filePath();
  const temporaryPath = `${destination}.${process.pid}.tmp`;
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      await fs.writeFile(temporaryPath, JSON.stringify(notes, null, 2), 'utf8');
      await fs.rename(temporaryPath, destination);
    });
  return saveQueue;
}
