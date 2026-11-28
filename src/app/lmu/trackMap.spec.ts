import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findBundledLmuTrackMap,
  loadLmuTrackMap,
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
    vehLapStartET: [overrides.lapStartET ?? 100],
    lapInvalidated: false,
    pos: [progress * 1000, 12, -progress * 500],
    vehInPits: [0],
    vehLapDistPct: [progress],
    vehLastLapTime: [100],
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

  it('keeps LMU north at the top and markers on the path', () => {
    const map = normalizeLmuTrackMap(
      [
        { x: 0, y: 0, distance: 0 },
        { x: 1000, y: 0, distance: 1000 },
        { x: 1000, y: 100, distance: 1100 },
        { x: 0, y: 100, distance: 1200 },
        { x: 0, y: 0, distance: 1300 },
      ],
      1300
    );
    const points = map.active.trackPathPoints;
    const width =
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height =
      Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));

    expect(width).toBeGreaterThan(height);
    expect(points[0].x).toBeLessThan(points[100].x);
    expect(points[420].y).toBeGreaterThan(points[0].y);
    expect(map.startFinish.point).toMatchObject({
      x: points[0].x,
      y: points[0].y,
    });
    expect(map.active.inside.startsWith(`M${points[0].x},${points[0].y}`)).toBe(
      true
    );
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
    expect(map.orientation).toBe('lmu-north-v2');
  });

  it('closes a gap at the line between the two ends of the lap', () => {
    const lap = [
      { x: 70, y: 0, distance: 20 },
      { x: 100, y: 30, distance: 60 },
      { x: 100, y: 100, distance: 150 },
      { x: 0, y: 100, distance: 250 },
      { x: 0, y: 0, distance: 350 },
      { x: 30, y: 0, distance: 380 },
    ];
    const withGap = normalizeLmuTrackMap(lap, 400);
    const withStart = normalizeLmuTrackMap(
      [{ x: 50, y: 0, distance: 0 }, ...lap],
      400
    );

    expect(withGap.active.trackPathPoints[0]).toEqual(
      withStart.active.trackPathPoints[0]
    );
  });

  it('promotes one full valid lap', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      expect(recorder.update(frame(index / 100))).toBeNull();
    }

    const map = recorder.update(frame(0, { lapStartET: 200, pos: [0, 12, 0] }));

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('records from the smoothed fraction when scoring has not moved', () => {
    // LMU publishes lap distance at 5 Hz, so across a 64 Hz poll the scoring
    // fraction is repeatedly identical -- and sample() drops any point whose
    // distance has not advanced. Pinning vehLapDistPct reproduces that: the
    // recorder collects a single point, far short of the twenty it needs.
    const stalled = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      stalled.update(frame(index / 100, { vehLapDistPct: [0] }));
    }
    expect(
      stalled.update(frame(0, { vehLapDistPct: [0], lapStartET: 200 }))
    ).toBeNull();

    // The same frames, with the reconstructed fraction supplied, promote a map.
    const smoothed = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      smoothed.update(frame(index / 100, { vehLapDistPct: [0] }), index / 100);
    }
    const map = smoothed.update(
      frame(0, { vehLapDistPct: [0], lapStartET: 200, pos: [0, 12, 0] }),
      0
    );

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('ignores a smoothed fraction that is negative or not finite', () => {
    // The bridge passes telemetry.LapDistPct, which is 0 with no player car
    // and could be NaN from a garbage frame. Either must fall back to scoring
    // rather than pinning progress.
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      expect(recorder.update(frame(index / 100), NaN)).toBeNull();
    }
    const map = recorder.update(
      frame(0, { lapStartET: 200, pos: [0, 12, 0] }),
      -1
    );

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('accepts the first lap when its time reaches scoring a few frames late', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100, { vehLastLapTime: [0] }));
    }

    expect(
      recorder.update(
        frame(0, { lapStartET: 200, pos: [0, 12, 0], vehLastLapTime: [0] })
      )
    ).toBeNull();
    for (let index = 1; index <= 9; index++) {
      expect(
        recorder.update(
          frame(index / 1000, { lapStartET: 200, vehLastLapTime: [0] })
        )
      ).toBeNull();
    }
    const map = recorder.update(frame(0.01, { lapStartET: 200 }));

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('waits for the finished lap rather than taking the previous lap time', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100, { vehLastLapTime: [87] }));
    }

    expect(
      recorder.update(frame(0, { lapStartET: 200, vehLastLapTime: [87] }))
    ).toBeNull();
    expect(
      recorder.update(frame(0.005, { lapStartET: 200 }))?.active.trackPathPoints
    ).toHaveLength(512);
  });

  it('does not take the previous lap time while scoring is still on the old lap', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100));
    }

    for (let index = 0; index <= 9; index++) {
      expect(
        recorder.update(
          frame(index / 1000, {
            lapStartET: 200,
            vehLapStartET: [100],
            vehLastLapTime: [100],
          })
        )
      ).toBeNull();
    }
    const map = recorder.update(
      frame(0.01, {
        lapStartET: 200,
        vehLapStartET: [200],
        vehLastLapTime: [100],
      })
    );

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('drops an untimed lap when scoring never reaches the new lap but still shows a matching time', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100));
    }
    for (let index = 0; index <= 60; index++) {
      expect(
        recorder.update(
          frame(index / 1000, {
            lapStartET: 200,
            elapsedTime: 200 + index / 10,
            vehLapStartET: [100],
            vehLastLapTime: [100],
          })
        )
      ).toBeNull();
    }

    expect(
      recorder.update(
        frame(0.07, {
          lapStartET: 200,
          elapsedTime: 206.1,
          vehLapStartET: [200],
          vehLastLapTime: [100],
        })
      )
    ).toBeNull();
  });

  it.each([
    ['stays unset', -1],
    ['stays at zero', 0],
    ['keeps the previous lap time', 87],
  ])('drops an untimed lap whose scoring time %s', (_, lapTime) => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100, { vehLastLapTime: [87] }));
    }
    for (let index = 0; index <= 60; index++) {
      expect(
        recorder.update(
          frame(index / 1000, {
            lapStartET: 200,
            elapsedTime: 200 + index / 10,
            vehLastLapTime: [lapTime],
          })
        )
      ).toBeNull();
    }

    expect(
      recorder.update(frame(0.07, { lapStartET: 200, elapsedTime: 206.1 }))
    ).toBeNull();
  });

  it('accepts a timed lap even when LMU marks it invalidated', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 100; index++) {
      recorder.update(frame(index / 100, { lapInvalidated: index === 50 }));
    }
    expect(recorder.update(frame(0, { lapStartET: 200 }))).not.toBeNull();
  });

  it('drops an in-progress lap when lapStartET goes backwards (session restart)', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 40; index++) {
      expect(recorder.update(frame(index / 100))).toBeNull();
    }
    expect(recorder.update(frame(0.5, { lapStartET: 50 }))).toBeNull();
    for (let index = 0; index <= 100; index++) {
      expect(
        recorder.update(frame(index / 100, { lapStartET: 50 }))
      ).toBeNull();
    }
    const map = recorder.update(frame(0, { lapStartET: 150, pos: [0, 12, 0] }));
    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('drops a lap cut short by a trip to the garage and saves the next full lap', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 40; index++) {
      expect(recorder.update(frame(index / 100))).toBeNull();
    }
    for (let index = 0; index < 10; index++) {
      expect(
        recorder.update(frame(0.4, { playerHasVehicle: false }))
      ).toBeNull();
    }
    expect(recorder.update(frame(0, { lapStartET: 300 }))).toBeNull();
    for (let index = 1; index <= 100; index++) {
      expect(
        recorder.update(frame(index / 100, { lapStartET: 300 }))
      ).toBeNull();
    }
    const map = recorder.update(frame(0, { lapStartET: 400, pos: [0, 12, 0] }));
    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('drops a lap with a hole in the middle of its recording', () => {
    const recorder = new LmuTrackMapRecorder();
    for (let index = 0; index <= 40; index++) {
      recorder.update(frame(index / 100));
    }
    for (let index = 90; index <= 100; index++) {
      recorder.update(frame(index / 100));
    }
    expect(
      recorder.update(frame(0, { lapStartET: 200, pos: [0, 12, 0] }))
    ).toBeNull();
  });

  it('records a lap whose timing line comes just before the distance wraps', () => {
    const recorder = new LmuTrackMapRecorder();
    recorder.update(frame(0.5));
    recorder.update(frame(0.9984, { lapStartET: 200 }));
    recorder.update(frame(0.9992, { lapStartET: 200 }));
    for (let index = 0; index <= 99; index++) {
      recorder.update(frame(index / 100, { lapStartET: 200 }));
    }

    const map = recorder.update(frame(0.9984, { lapStartET: 300 }));

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('drops a lap that starts in the pit lane and saves the next one', () => {
    const recorder = new LmuTrackMapRecorder();
    recorder.update(frame(0.5, { vehInPits: [1] }));
    for (let index = 0; index <= 10; index++) {
      recorder.update(frame(index / 100, { lapStartET: 200, vehInPits: [1] }));
    }
    for (let index = 11; index <= 100; index++) {
      recorder.update(frame(index / 100, { lapStartET: 200 }));
    }
    expect(recorder.update(frame(0, { lapStartET: 300 }))).toBeNull();

    for (let index = 1; index <= 100; index++) {
      recorder.update(frame(index / 100, { lapStartET: 300 }));
    }
    const map = recorder.update(frame(0, { lapStartET: 400, pos: [0, 12, 0] }));

    expect(map?.active.trackPathPoints).toHaveLength(512);
  });

  it('drops a lap whose recording starts after the line', () => {
    const recorder = new LmuTrackMapRecorder();
    expect(recorder.update(frame(0.99))).toBeNull();
    expect(recorder.update(frame(0.2, { lapStartET: 200 }))).toBeNull();
    for (let index = 21; index <= 100; index++) {
      recorder.update(frame(index / 100, { lapStartET: 200 }));
    }
    expect(
      recorder.update(frame(0, { lapStartET: 300, pos: [0, 12, 0] }))
    ).toBeNull();
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

  it.each([
    'Algarve International Circuit',
    'Autodromo Enzo e Dino Ferrari',
    'Autodromo Nazionale Monza',
    'Autódromo José Carlos Pace',
    'Bahrain Endurance Circuit',
    'Bahrain International Circuit',
    'Bahrain Outer Circuit',
    'Bahrain Paddock Circuit',
    'Circuit de Barcelona',
    'Circuit de la Sarthe',
    'Circuit de la Sarthe Mulsanne',
    'Circuit de Spa-Francorchamps',
    'Circuit of the Americas',
    'COTA National Circuit',
    'Daytona International Speedway Road Course',
    'Fuji Speedway',
    'Fuji Speedway Classic',
    'Lusail International Circuit',
    'Lusail Short Circuit',
    'Monza Curva Grande Circuit',
    'Paul Ricard - 1A',
    'Paul Ricard - 1A-V2',
    'Paul Ricard - 1A-V2-Short',
    'Paul Ricard - 3A',
    'Paul Ricard - ELMS',
    'Sebring International Raceway',
    'Sebring School Circuit',
    'Silverstone Grand Prix Circuit - WEC',
    'Silverstone International Circuit',
    'Silverstone National Circuit',
    'WeatherTech Raceway Laguna Seca',
  ])('loads the bundled TinyPedal map for %s', (trackName) => {
    const map = findBundledLmuTrackMap(trackName);

    expect(map?.orientation).toBe('lmu-north-v2');
    expect(map?.active.trackPathPoints).toHaveLength(512);
    expect(map?.turns).toBeUndefined();
  });

  it('loads bundled maps through tolerant aliases', () => {
    expect(findBundledLmuTrackMap('Portimão')).not.toBeNull();
    expect(findBundledLmuTrackMap('Qatar')).not.toBeNull();
    expect(
      findBundledLmuTrackMap('Bahrain International Endurance Circuit')
    ).not.toBeNull();
    expect(findBundledLmuTrackMap('Fuji Classic')).not.toBeNull();
  });

  it('loads a bundled map before a saved one, and a saved one only when nothing is bundled', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-lmu-'));
    temporaryDirectories.push(directory);
    const storage = new LmuTrackMapStorage(path.join(directory, 'maps.json'));
    const saved = normalizeLmuTrackMap(
      [
        { x: 0, y: 0, distance: 0 },
        { x: 100, y: 0, distance: 500 },
        { x: 0, y: 0, distance: 1000 },
      ],
      1000
    );
    storage.save('Monza', saved);
    storage.save('Unbundled Test Circuit', saved);

    const bundled = loadLmuTrackMap('Monza', storage);
    expect(bundled?.source).toBe('bundled');
    expect(bundled?.map).not.toEqual(saved);
    expect(loadLmuTrackMap('Unbundled Test Circuit', storage)).toMatchObject({
      map: saved,
      source: 'storage',
    });
    expect(loadLmuTrackMap('Another Unknown Circuit', storage)).toBeNull();
  });

  it('prefers a saved map over a bundled one that only shares part of the name', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-lmu-'));
    temporaryDirectories.push(directory);
    const storage = new LmuTrackMapStorage(path.join(directory, 'maps.json'));
    const variant = 'Autodromo Nazionale Monza Junior';

    expect(loadLmuTrackMap(variant, storage)?.source).toBe('bundled');

    const saved = normalizeLmuTrackMap(
      [
        { x: 0, y: 0, distance: 0 },
        { x: 100, y: 0, distance: 500 },
        { x: 0, y: 0, distance: 1000 },
      ],
      1000
    );
    storage.save(variant, saved);

    expect(loadLmuTrackMap(variant, storage)).toMatchObject({
      map: saved,
      source: 'storage',
    });
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

  it('ignores a saved map whose path points are not finite', () => {
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
    const broken = {
      ...map,
      active: {
        ...map.active,
        trackPathPoints: map.active.trackPathPoints.map(() => null),
      },
    } as unknown as typeof map;
    storage.save('Broken Test Circuit', broken);

    expect(storage.load('Broken Test Circuit')).toBeNull();
  });
});
