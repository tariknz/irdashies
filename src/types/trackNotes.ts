import type { TrackNote } from './widgetConfigs';

export interface TrackNotesBridge {
  getNotes(): Promise<TrackNote[]>;
  saveNotes(notes: TrackNote[]): Promise<void>;
}
