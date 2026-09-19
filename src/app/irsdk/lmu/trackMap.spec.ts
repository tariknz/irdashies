import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findTinyPedalTrackMap,
  LmuTrackMapRecorder,
  LmuTrackMapStorage,
  lmuGroundPosition,
  normalizeLmuTrackMap,
  parseTinyPedalTrackMap,
  type LmuMapFrame,
} from './trackMap';

const temporaryDirectories: string[] = [];

function frame(
  progress: number,
  overrides: Partial<LmuMapFrame> = {}
): LmuMapFrame {
  return {
    trackName: 'Lusail International Circuit',
    lapDist: 1000,
    playerHasVehicle: true,
    playerVehicleIdx: 0,
    lapStartET: 100,
    lapInvalidated: false,
    pos: [progress * 1000, 12, -progress * 500],
    vehLapDistPct: [progress],
    vehLastLapTime: [90],
    ...overrides,
  };
}

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach((directory) =>
      fs.rmSync(directory, { recursive: true, force: true })
    );
});

describe('LMU track map', () => {
  it('uses LMU X and negated Z as the ground plane', () => {
    expect(lmuGroundPosition([12, 99, -34])).toEqual({ x: 12, y: 34 });
  });

  it('normalizes and centers coordinates in the track canvas', () => {
    const map = normalizeLmuTrackMap(
      [
        { x: -100, y: -50, distance: 0 },
        { x: 100, y: -50, distance: 250 },
        { x: 100, y: 50, distance: 500 },
        { x: -100, y: 50, distance: 750 },
        { x: -100, y: -50, distance: 1000 },
      ],
      1000
    );

    expect(map.active.trackPathPoints).toHaveLength(512);
    expect(
      map.active.trackPathPoints.every(
        ({ x, y }) => x >= 80 && x <= 1840 && y >= 80 && y <= 1000
      )
    ).toBe(true);
    expect(map.active.inside).toMatch(/^M.+ Z$/);
    expect(map.startFinish.point.length).toBe(0);
  });

  it('promotes one full valid lap', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      expect(recorder.update(frame(index / 100))).toBeNull();
    }

    const map = recorder.update(frame(0, { lapStartET: 200, pos: [0, 12, 0] }));

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('accepts a timed lap even when LMU marks it invalidated', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100, { lapInvalidated: index === 50 }));
    }
    expect(recorder.update(frame(0, { lapStartET: 200 }))).not.toBeNull();
  });

  it('parses TinyPedal raw map coordinates', () => {
    const points = Array.from(
      { length: 20 },
      (_, index) => `${index},${index % 2}`
    ).join(' ');
    const map = parseTinyPedalTrackMap(
      `<svg><polyline id="map" points="${points}"/></svg>`
    );

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('matches TinyPedal SVG names without accents or punctuation', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tinypedal-'));
    temporaryDirectories.push(directory);
    const points = Array.from(
      { length: 20 },
      (_, index) => `${index},${index % 2}`
    ).join(' ');
    fs.writeFileSync(
      path.join(directory, 'Autódromo José Carlos Pace.svg'),
      `<svg><polyline id="map" points="${points}"/></svg>`
    );

    expect(
      findTinyPedalTrackMap('Autodromo Jose Carlos Pace', [directory])?.filePath
    ).toBe(path.join(directory, 'Autódromo José Carlos Pace.svg'));
  });

  it('persists maps by exact LMU track name', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-lmu-'));
    temporaryDirectories.push(directory);
    const storage = new LmuTrackMapStorage(path.join(directory, 'maps.json'));
    const map = normalizeLmuTrackMap(
      [
        { x: 0, y: 0, distance: 0 },
        { x: 100, y: 0, distance: 500 },
        { x: 0, y: 0, distance: 1000 },
      ],
      1000
    );

    fs.writeFileSync(path.join(directory, 'maps.json'), '[]');
    storage.save('Autódromo José Carlos Pace', map);

    expect(storage.load('Autódromo José Carlos Pace')).toEqual(map);
    expect(storage.load('Lusail International Circuit')).toBeNull();
  });
});
