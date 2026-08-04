import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Incident } from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';

// Use a real temp directory for tests
let tmpDir: string;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-test-'));
  const { __resetForTests } = await import('./incidentStorage');
  __resetForTests();
});

afterEach(async () => {
  // Flush anything still pending before the directory it targets disappears.
  const { __awaitPendingWrite } = await import('./incidentStorage');
  await __awaitPendingWrite();
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
    const result = await loadIncidents('session123', tmpDir);
    expect(result).toEqual([]);
  });

  it('appendIncident persists incident and is readable back', async () => {
    const { appendIncident, loadIncidents, __awaitPendingWrite } =
      await import('./incidentStorage');
    await appendIncident('session123', makeIncident('1'), tmpDir);

    const loaded = await loadIncidents('session123', tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('1');

    // The write is debounced; force it and check the file actually landed.
    await __awaitPendingWrite();
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'incidents-session123.json'), 'utf-8')
    ) as Incident[];
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].id).toBe('1');
  });

  it('clearIncidents removes the session file', async () => {
    const { appendIncident, clearIncidents, loadIncidents } =
      await import('./incidentStorage');
    await appendIncident('session123', makeIncident('1'), tmpDir);
    await clearIncidents('session123', tmpDir);
    expect(await loadIncidents('session123', tmpDir)).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, 'incidents-session123.json'))).toBe(
      false
    );
  });

  it('pruneOldSessions keeps all when retention is "all"', async () => {
    const {
      appendIncident,
      pruneOldSessions,
      listSessionFiles,
      __awaitPendingWrite,
    } = await import('./incidentStorage');
    await appendIncident('s1', makeIncident('1'), tmpDir);
    await appendIncident('s2', makeIncident('2'), tmpDir);
    await appendIncident('s3', makeIncident('3'), tmpDir);
    await __awaitPendingWrite();
    await pruneOldSessions('all', tmpDir);
    expect(await listSessionFiles(tmpDir)).toHaveLength(3);
  });

  it('pruneOldSessions deletes oldest files when limit exceeded', async () => {
    const {
      appendIncident,
      pruneOldSessions,
      listSessionFiles,
      __awaitPendingWrite,
    } = await import('./incidentStorage');
    await appendIncident('s1', makeIncident('1'), tmpDir);
    await appendIncident('s2', makeIncident('2'), tmpDir);
    await appendIncident('s3', makeIncident('3'), tmpDir);
    await appendIncident('s4', makeIncident('4'), tmpDir);
    await appendIncident('s5', makeIncident('5'), tmpDir);
    await appendIncident('s6', makeIncident('6'), tmpDir);
    await __awaitPendingWrite();
    await pruneOldSessions(5, tmpDir);
    const remaining = await listSessionFiles(tmpDir);
    expect(remaining).toHaveLength(5);
    // s1 (oldest) should be gone
    expect(remaining.some((f) => f.includes('incidents-s1.json'))).toBe(false);
  });

  it('flushes the outgoing session to disk when appending to a new session', async () => {
    const { appendIncident, __awaitPendingWrite } =
      await import('./incidentStorage');
    await appendIncident('sessionA', makeIncident('a1'), tmpDir);
    await appendIncident('sessionB', makeIncident('b1'), tmpDir);
    await __awaitPendingWrite();

    const onDiskA = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'incidents-sessionA.json'), 'utf-8')
    ) as Incident[];
    expect(onDiskA.map((i) => i.id)).toEqual(['a1']);
  });

  it('does not re-read the file on every append (no read-modify-write per incident)', async () => {
    const { appendIncident, loadIncidents } = await import('./incidentStorage');
    await appendIncident('perf-session', makeIncident('1'), tmpDir);

    // Simulate something else touching the file on disk between appends.
    // If appendIncident performed a read-modify-write (the old O(n^2)
    // behaviour), the next append would pick this up and merge it in; with
    // the in-memory cache it must be completely ignored.
    const filePath = path.join(tmpDir, 'incidents-perf-session.json');
    fs.writeFileSync(filePath, JSON.stringify([makeIncident('planted')]));

    await appendIncident('perf-session', makeIncident('2'), tmpDir);
    await appendIncident('perf-session', makeIncident('3'), tmpDir);

    const loaded = await loadIncidents('perf-session', tmpDir);
    expect(loaded.map((i) => i.id)).toEqual(['1', '2', '3']);
    expect(loaded.some((i) => i.id === 'planted')).toBe(false);
  });

  it('flushIncidentsOnShutdown writes the current session synchronously', async () => {
    const { appendIncident, flushIncidentsOnShutdown } =
      await import('./incidentStorage');
    await appendIncident('shutdown-session', makeIncident('1'), tmpDir);

    flushIncidentsOnShutdown();

    const onDisk = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'incidents-shutdown-session.json'),
        'utf-8'
      )
    ) as Incident[];
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].id).toBe('1');
  });
});
