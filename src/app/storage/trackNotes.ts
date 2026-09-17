import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import type { TrackNote } from '@irdashies/types';

const filePath = () => path.join(app.getPath('userData'), 'track-notes.json');

export async function loadTrackNotes(): Promise<TrackNote[]> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(filePath(), 'utf8'));
    return Array.isArray(value) ? (value as TrackNote[]) : [];
  } catch {
    return [];
  }
}

export async function saveTrackNotes(notes: TrackNote[]): Promise<void> {
  await fs.writeFile(filePath(), JSON.stringify(notes, null, 2), 'utf8');
}
