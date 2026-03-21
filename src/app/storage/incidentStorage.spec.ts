import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Incident } from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';

// Use a real temp directory for tests
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function makeIncident(id: string): Incident {
  return {
    id,
    carIdx: 0,
    driverName: 'Test Driver',
    carNumber: '00',
    teamName: 'Test Team',
    sessionNum: 0,
    sessionTime: 0,
    lapNum: 1,
    replayFrameNum: 0,
    type: IncidentType.PitEntry,
    lapDistPct: 0,
    timestamp: Date.now(),
  };
}

// We need to pass the storage dir to the functions rather than use app.getPath
// So the storage module should accept an optional storageDir param for testability

describe('incidentStorage', () => {
  it('loadIncidents returns [] when no file exists', async () => {
    const { loadIncidents } = await import('./incidentStorage');
    const result = loadIncidents('session123', tmpDir);
    expect(result).toEqual([]);
  });

  it('appendIncident creates file and persists incident', async () => {
    const { appendIncident, loadIncidents } = await import('./incidentStorage');
    appendIncident('session123', makeIncident('1'), tmpDir);
    const loaded = loadIncidents('session123', tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('1');
  });

  it('clearIncidents removes the session file', async () => {
    const { appendIncident, clearIncidents, loadIncidents } =
      await import('./incidentStorage');
    appendIncident('session123', makeIncident('1'), tmpDir);
    clearIncidents('session123', tmpDir);
    expect(loadIncidents('session123', tmpDir)).toEqual([]);
  });

  it('pruneOldSessions keeps all when retention is "all"', async () => {
    const { appendIncident, pruneOldSessions, listSessionFiles } =
      await import('./incidentStorage');
    appendIncident('s1', makeIncident('1'), tmpDir);
    appendIncident('s2', makeIncident('2'), tmpDir);
    appendIncident('s3', makeIncident('3'), tmpDir);
    pruneOldSessions('all', tmpDir);
    expect(listSessionFiles(tmpDir)).toHaveLength(3);
  });

  it('pruneOldSessions deletes oldest files when limit exceeded', async () => {
    const { appendIncident, pruneOldSessions, listSessionFiles } =
      await import('./incidentStorage');
    appendIncident('s1', makeIncident('1'), tmpDir);
    appendIncident('s2', makeIncident('2'), tmpDir);
    appendIncident('s3', makeIncident('3'), tmpDir);
    appendIncident('s4', makeIncident('4'), tmpDir);
    appendIncident('s5', makeIncident('5'), tmpDir);
    appendIncident('s6', makeIncident('6'), tmpDir);
    pruneOldSessions(5, tmpDir);
    const remaining = listSessionFiles(tmpDir);
    expect(remaining).toHaveLength(5);
    // s1 (oldest) should be gone
    expect(remaining.some((f) => f.includes('incidents-s1.json'))).toBe(false);
  });
});
