import { ipcMain } from 'electron';
import type { TrackNote } from '@irdashies/types';
import { loadTrackNotes, saveTrackNotes } from '../storage/trackNotes';

export function setupTrackNotesBridge() {
  ipcMain.handle('trackNotes:get', () => loadTrackNotes());
  ipcMain.handle('trackNotes:save', (_event, notes: TrackNote[]) =>
    saveTrackNotes(notes)
  );
}
