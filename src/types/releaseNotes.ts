export interface ReleaseNotes {
  version: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string | null;
}

export type ReleaseNotesResult =
  | { status: 'ready'; release: ReleaseNotes; cached: boolean }
  | { status: 'unavailable'; reason: 'not-found' | 'offline' };

export type ReleaseNotesSummary = Pick<
  ReleaseNotes,
  'version' | 'title' | 'publishedAt'
>;

export type ReleaseNotesHistoryResult =
  | {
      status: 'ready';
      releases: ReleaseNotesSummary[];
      hasMore: boolean;
      cached: boolean;
    }
  | { status: 'unavailable'; reason: 'offline' };

export interface ReleaseNotesStatus {
  currentVersion: string;
  availableVersion: string | null;
  pendingVersion: string | null;
  unreadVersion: string | null;
  autoShow: boolean;
  development: boolean;
  simulation: boolean;
}

export interface ReleaseNotesBridge {
  getStatus(): Promise<ReleaseNotesStatus>;
  getRelease(version: string): Promise<ReleaseNotesResult>;
  getReleases(page: number): Promise<ReleaseNotesHistoryResult>;
  dismiss(version: string): Promise<void>;
  setAutoShow(enabled: boolean): Promise<void>;
}
