import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Incident } from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import logger from '../logger';

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

  it.each(['{}', 'null', '[{}]'])(
    'loadIncidents returns [] for invalid persisted shape %s',
    async (contents) => {
      const { loadIncidents } = await import('./incidentStorage');
      fs.writeFileSync(path.join(tmpDir, 'incidents-invalid.json'), contents);

      expect(await loadIncidents('invalid', tmpDir)).toEqual([]);
    }
  );

  it('redacts the storage directory from invalid-file warnings', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { loadIncidents } = await import('./incidentStorage');
    fs.writeFileSync(path.join(tmpDir, 'incidents-private.json'), '{}');

    expect(await loadIncidents('private', tmpDir)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[IncidentStorage] Incident file has an invalid shape:',
      'incidents-private.json'
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(tmpDir);

    warn.mockRestore();
  });

  it('ignores empty session IDs without creating storage files', async () => {
    const { loadIncidents, appendIncident, clearIncidents } =
      await import('./incidentStorage');

    expect(await loadIncidents('', tmpDir)).toEqual([]);
    await appendIncident('', makeIncident('1'), tmpDir);
    await clearIncidents('', tmpDir);

    expect(fs.readdirSync(tmpDir)).toEqual([]);
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
    for (let i = 1; i <= 6; i++) {
      const timestamp = new Date(1_000 * i);
      fs.utimesSync(
        path.join(tmpDir, `incidents-s${i}.json`),
        timestamp,
        timestamp
      );
    }
    await pruneOldSessions(5, tmpDir);
    const remaining = await listSessionFiles(tmpDir);
    expect(remaining).toHaveLength(5);
    // s1 (oldest) should be gone
    expect(remaining.some((f) => f.includes('incidents-s1.json'))).toBe(false);
  });

  it('does not recreate a pruned session from a pending write', async () => {
    const { appendIncident, pruneOldSessions, __awaitPendingWrite } =
      await import('./incidentStorage');
    for (let i = 1; i <= 6; i++) {
      await appendIncident(`s${i}`, makeIncident(String(i)), tmpDir);
    }
    await __awaitPendingWrite();
    for (let i = 1; i <= 6; i++) {
      const timestamp = new Date(1_000 * i);
      fs.utimesSync(
        path.join(tmpDir, `incidents-s${i}.json`),
        timestamp,
        timestamp
      );
    }

    await appendIncident('s1', makeIncident('pending'), tmpDir);
    await pruneOldSessions(5, tmpDir);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(fs.existsSync(path.join(tmpDir, 'incidents-s1.json'))).toBe(false);
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

  it('does not lose an append when another session loads concurrently', async () => {
    const { appendIncident, loadIncidents, __awaitPendingWrite } =
      await import('./incidentStorage');

    await Promise.all([
      appendIncident('sessionA', makeIncident('a1'), tmpDir),
      loadIncidents('sessionB', tmpDir),
    ]);
    await __awaitPendingWrite();

    const onDiskA = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'incidents-sessionA.json'), 'utf-8')
    ) as Incident[];
    expect(onDiskA.map((incident) => incident.id)).toEqual(['a1']);
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

  it('keeps only the newest 2,000 incidents in memory and on disk', async () => {
    const { appendIncident, loadIncidents, __awaitPendingWrite } =
      await import('./incidentStorage');
    for (let i = 0; i < 2_005; i++) {
      await appendIncident('endurance', makeIncident(String(i)), tmpDir);
    }

    const loaded = await loadIncidents('endurance', tmpDir);
    expect(loaded).toHaveLength(2_000);
    expect(loaded[0].id).toBe('5');
    expect(loaded.at(-1)?.id).toBe('2004');

    await __awaitPendingWrite();
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'incidents-endurance.json'), 'utf-8')
    ) as Incident[];
    expect(onDisk.map((incident) => incident.id)).toEqual(
      loaded.map((incident) => incident.id)
    );
    expect(fs.readdirSync(tmpDir).some((file) => file.endsWith('.tmp'))).toBe(
      false
    );
  });

  it('flushIncidentsOnShutdown writes the current session', async () => {
    const { appendIncident, flushIncidentsOnShutdown } =
      await import('./incidentStorage');
    await appendIncident('shutdown-session', makeIncident('1'), tmpDir);

    await flushIncidentsOnShutdown();

    const onDisk = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'incidents-shutdown-session.json'),
        'utf-8'
      )
    ) as Incident[];
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].id).toBe('1');
  });

  it('flushIncidentsOnShutdown cannot be overwritten by an older async snapshot', async () => {
    const { appendIncident, flushIncidentsOnShutdown, __awaitPendingWrite } =
      await import('./incidentStorage');
    await appendIncident('shutdown-race', makeIncident('old'), tmpDir);
    const olderFlush = __awaitPendingWrite();
    const newerAppend = appendIncident(
      'shutdown-race',
      makeIncident('new'),
      tmpDir
    );

    await flushIncidentsOnShutdown();
    await Promise.all([olderFlush, newerAppend]);

    const onDisk = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'incidents-shutdown-race.json'),
        'utf-8'
      )
    ) as Incident[];
    expect(onDisk.map((incident) => incident.id)).toEqual(['old', 'new']);
  });
});
