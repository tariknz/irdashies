import type { LmuTrackMap } from '@irdashies/types';
import bundledTrackMaps from './lmu-track-maps.json';
import { JsonFileStore, type JsonFileStoreLogger } from './jsonFileStore';

const WIDTH = 1920;
const HEIGHT = 1080;
const MARGIN = 80;
const RESAMPLED_POINTS = 512;
const MIN_RECORDED_POINTS = 20;
const MAX_COVERAGE_GAP_FRACTION = 0.05;
const LAP_TIME_TOLERANCE_SECONDS = 0.05;
const LAP_TIME_WAIT_SECONDS = 5;
const SCORING_SYNC_TOLERANCE_SECONDS = 0.05;

interface RecordedPoint {
  x: number;
  y: number;
  distance: number;
}

export interface LmuMapFrame {
  trackName: string;
  lapDist: number;
  playerHasVehicle: boolean;
  playerVehicleIdx: number;
  elapsedTime?: number;
  lapStartET?: number;
  lapInvalidated?: boolean;
  pos?: ArrayLike<number>;
  vehInPits: ArrayLike<number>;
  vehLapDistPct: ArrayLike<number>;
  vehLastLapTime: ArrayLike<number>;
  vehLapStartET?: ArrayLike<number>;
}

const finite = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);

export function lmuGroundPosition(
  position: ArrayLike<number>
): { x: number; y: number } | null {
  const x = position[0];
  const z = position[2];
  return finite(x) && finite(z) ? { x, y: -z } : null;
}

// Canvas y grows downward, so a counter-clockwise turn on screen is (x, y) -> (y, -x).
export const rotateLmuMapPointCounterClockwise = <
  T extends { x: number; y: number },
>(
  point: T
): T => ({ ...point, x: point.y, y: -point.x });

function interpolatePoint(
  points: readonly RecordedPoint[],
  distance: number,
  trackLength: number
): RecordedPoint {
  const first = points[0];
  const last = points[points.length - 1];
  if (distance < first.distance || distance > last.distance) {
    const span = first.distance + trackLength - last.distance;
    const travelled =
      distance > last.distance
        ? distance - last.distance
        : distance + trackLength - last.distance;
    const amount = span > 0 ? travelled / span : 0;
    return {
      x: last.x + (first.x - last.x) * amount,
      y: last.y + (first.y - last.y) * amount,
      distance,
    };
  }
  let upper = 1;
  while (upper < points.length && points[upper].distance < distance) upper++;
  const high = points[Math.min(upper, points.length - 1)];
  const low = points[Math.max(0, upper - 1)];
  const span = high.distance - low.distance;
  const amount = span > 0 ? (distance - low.distance) / span : 0;
  return {
    x: low.x + (high.x - low.x) * amount,
    y: low.y + (high.y - low.y) * amount,
    distance,
  };
}

export interface LmuMapTransform {
  scale: number;
  minX: number;
  minY: number;
  offsetX: number;
  offsetY: number;
}

export function normalizeLmuTrackMap(
  recorded: readonly RecordedPoint[],
  trackLength: number
): LmuTrackMap {
  return normalizeLmuTrackMapWithTransform(recorded, trackLength).map;
}

export function normalizeLmuTrackMapWithTransform(
  recorded: readonly RecordedPoint[],
  trackLength: number
): { map: LmuTrackMap; transform: LmuMapTransform } {
  const points = Array.from({ length: RESAMPLED_POINTS }, (_, index) =>
    rotateLmuMapPointCounterClockwise(
      interpolatePoint(
        recorded,
        (trackLength * index) / RESAMPLED_POINTS,
        trackLength
      )
    )
  );
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const scale = Math.min(
    (WIDTH - MARGIN * 2) / Math.max(1, maxX - minX),
    (HEIGHT - MARGIN * 2) / Math.max(1, maxY - minY)
  );
  const offsetX = (WIDTH - (maxX - minX) * scale) / 2;
  const offsetY = (HEIGHT - (maxY - minY) * scale) / 2;
  const normalized = points.map((point) => ({
    x: Number(((point.x - minX) * scale + offsetX).toFixed(2)),
    y: Number(((point.y - minY) * scale + offsetY).toFixed(2)),
  }));
  const inside = normalized
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
  const first = normalized[0];

  return {
    map: {
      orientation: 'lmu-ccw-v1',
      active: {
        inside: `${inside} Z`,
        outside: `${inside} Z`,
        trackPathPoints: normalized,
        totalLength: normalized.length - 1,
      },
      startFinish: {
        line: `M${first.x},${first.y - 30} L${first.x},${first.y + 30}`,
        point: { ...first, length: 0 },
        direction: 'anticlockwise',
      },
    },
    transform: { scale, minX, minY, offsetX, offsetY },
  };
}

const normalizeTrackName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const BUNDLED_LMU_ALIASES: Record<string, string> = {
  portimao: 'Algarve International Circuit',
  autodromointernacionaldoalgarve: 'Algarve International Circuit',
  imola: 'Autodromo Enzo e Dino Ferrari',
  interlagos: 'Autódromo José Carlos Pace',
  monza: 'Autodromo Nazionale Monza',
  barcelona: 'Circuit de Barcelona',
  circuitdecatalunya: 'Circuit de Barcelona',
  circuitdebarcelonacatalunya: 'Circuit de Barcelona',
  lemans: 'Circuit de la Sarthe',
  circuitdes24heuresdumans: 'Circuit de la Sarthe',
  lemansnochicane: 'Circuit de la Sarthe Mulsanne',
  circuitdelasarthemulsannenochicanes: 'Circuit de la Sarthe Mulsanne',
  cota: 'Circuit of the Americas',
  spa: 'Circuit de Spa-Francorchamps',
  spafrancorchamps: 'Circuit de Spa-Francorchamps',
  spaendurancelayout: 'Circuit de Spa-Francorchamps',
  fuji: 'Fuji Speedway',
  fujiclassic: 'Fuji Speedway Classic',
  qatar: 'Lusail International Circuit',
  lusail: 'Lusail International Circuit',
  paulricard: 'Paul Ricard - ELMS',
  circuitpaulricard: 'Paul Ricard - ELMS',
  sebring: 'Sebring International Raceway',
  silverstone: 'Silverstone Grand Prix Circuit - WEC',
  silverstonegrandprix: 'Silverstone Grand Prix Circuit - WEC',
  bahrain: 'Bahrain International Circuit',
  bahraininternationalendurancecircuit: 'Bahrain Endurance Circuit',
  bahraininternationaloutercircuit: 'Bahrain Outer Circuit',
  bahraininternationalpaddockcircuit: 'Bahrain Paddock Circuit',
  daytona: 'Daytona International Speedway Road Course',
  lagunaseca: 'WeatherTech Raceway Laguna Seca',
};

const bundledMaps = bundledTrackMaps as unknown as Record<string, LmuTrackMap>;

function findExactBundledLmuTrackMap(normalized: string): LmuTrackMap | null {
  const exactTitle = Object.keys(bundledMaps).find(
    (title) => normalizeTrackName(title) === normalized
  );
  const alias = BUNDLED_LMU_ALIASES[normalized];
  return bundledMaps[exactTitle ?? alias] ?? null;
}

function findPartialBundledLmuTrackMap(normalized: string): LmuTrackMap | null {
  const partialTitle = Object.keys(bundledMaps)
    .filter((title) => {
      const candidate = normalizeTrackName(title);
      return candidate.includes(normalized) || normalized.includes(candidate);
    })
    .sort(
      (a, b) => normalizeTrackName(b).length - normalizeTrackName(a).length
    )[0];
  return partialTitle ? (bundledMaps[partialTitle] ?? null) : null;
}

export function findBundledLmuTrackMap(trackName: string): LmuTrackMap | null {
  const normalized = normalizeTrackName(trackName);
  if (!normalized) return null;
  return (
    findExactBundledLmuTrackMap(normalized) ??
    findPartialBundledLmuTrackMap(normalized)
  );
}

export function parseTinyPedalTrackMap(svg: string): LmuTrackMap | null {
  const pointsAttribute = svg.match(
    /<polyline\b[^>]*\bid=["']map["'][^>]*\bpoints=["']([^"']+)["']/i
  )?.[1];
  if (!pointsAttribute) return null;

  const coordinates = pointsAttribute
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter(
      (pair): pair is [number, number] =>
        pair.length === 2 && pair.every(Number.isFinite)
    );
  if (coordinates.length < MIN_RECORDED_POINTS) return null;

  let distance = 0;
  const recorded = coordinates.map(([x, y], index) => {
    if (index > 0) {
      const [previousX, previousY] = coordinates[index - 1];
      distance += Math.hypot(x - previousX, y - previousY);
    }
    return { x, y, distance };
  });
  if (distance <= 0) return null;

  return normalizeLmuTrackMap(recorded, distance);
}

export class LmuTrackMapRecorder {
  private trackName = '';
  private lapStartET: number | null = null;
  private recording = false;
  private points: RecordedPoint[] = [];
  private completedPoints: RecordedPoint[] | null = null;
  private completedLapTime = 0;
  private completedTrackLength = 0;

  /**
   * @param smoothedProgress The player's lap fraction reconstructed at the
   *   poll rate. Preferred over the raw scoring fraction, which only moves at
   *   5 Hz and left the recorder sampling roughly one point in thirteen.
   *   Rejected when negative as well as non-finite: the caller passes
   *   `telemetry.LapDistPct`, which is 0 with no player car -- finite, and
   *   would otherwise beat the fallback and pin progress at 0.
   */
  update(frame: LmuMapFrame, smoothedProgress?: number): LmuTrackMap | null {
    if (frame.trackName !== this.trackName) this.reset(frame.trackName);
    if (
      !frame.playerHasVehicle ||
      frame.playerVehicleIdx < 0 ||
      !finite(frame.lapStartET) ||
      !frame.pos ||
      frame.lapDist <= 0
    ) {
      return null;
    }

    const progress =
      smoothedProgress !== undefined &&
      finite(smoothedProgress) &&
      smoothedProgress >= 0
        ? smoothedProgress
        : frame.vehLapDistPct[frame.playerVehicleIdx];
    if (!finite(progress)) return null;

    if (this.lapStartET === null) {
      this.lapStartET = frame.lapStartET;
      this.recording = progress <= 0.02;
    } else if (frame.lapStartET < this.lapStartET) {
      this.reset(frame.trackName);
      return null;
    } else if (frame.lapStartET > this.lapStartET) {
      this.holdCompletedLap(frame.lapDist, frame.lapStartET - this.lapStartET);
      this.lapStartET = frame.lapStartET;
      this.recording = true;
      this.points = [];
      this.sample(frame, progress);
      return this.resolveCompletedLap(frame);
    }

    if (this.recording) this.sample(frame, progress);
    return this.resolveCompletedLap(frame);
  }

  reset(trackName = ''): void {
    this.trackName = trackName;
    this.lapStartET = null;
    this.recording = false;
    this.points = [];
    this.completedPoints = null;
  }

  private sample(frame: LmuMapFrame, progress: number): void {
    if (frame.vehInPits[frame.playerVehicleIdx] === 1) {
      this.recording = false;
      this.points = [];
      return;
    }
    if (!frame.pos) return;
    const position = lmuGroundPosition(frame.pos);
    const distance = progress * frame.lapDist;
    const previous = this.points[this.points.length - 1];
    if (
      !position ||
      distance < 0 ||
      (previous
        ? distance <= previous.distance
        : distance > frame.lapDist * MAX_COVERAGE_GAP_FRACTION)
    )
      return;
    this.points.push({ ...position, distance });
  }

  private holdCompletedLap(trackLength: number, lapTime: number): void {
    this.completedPoints =
      this.points.length >= MIN_RECORDED_POINTS && this.coversLap(trackLength)
        ? this.points
        : null;
    this.completedLapTime = lapTime;
    this.completedTrackLength = trackLength;
  }

  private resolveCompletedLap(frame: LmuMapFrame): LmuTrackMap | null {
    const points = this.completedPoints;
    if (!points || this.lapStartET === null) return null;
    const reportedLapTime = frame.vehLastLapTime[frame.playerVehicleIdx];
    const scoringLapStart = frame.vehLapStartET?.[frame.playerVehicleIdx];
    const scoringCaughtUp =
      frame.vehLapStartET === undefined ||
      (finite(scoringLapStart) &&
        scoringLapStart >= this.lapStartET - SCORING_SYNC_TOLERANCE_SECONDS);
    if (
      scoringCaughtUp &&
      finite(reportedLapTime) &&
      reportedLapTime > 0 &&
      Math.abs(reportedLapTime - this.completedLapTime) <=
        LAP_TIME_TOLERANCE_SECONDS
    ) {
      this.completedPoints = null;
      return normalizeLmuTrackMap(points, this.completedTrackLength);
    }
    if (
      finite(frame.elapsedTime) &&
      frame.elapsedTime - this.lapStartET > LAP_TIME_WAIT_SECONDS
    ) {
      this.completedPoints = null;
    }
    return null;
  }

  private coversLap(trackLength: number): boolean {
    const maxGap = trackLength * MAX_COVERAGE_GAP_FRACTION;
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    if (
      !first ||
      !last ||
      first.distance + trackLength - last.distance > maxGap
    ) {
      return false;
    }
    for (let index = 1; index < this.points.length; index += 1) {
      if (
        this.points[index].distance - this.points[index - 1].distance >
        maxGap
      ) {
        return false;
      }
    }
    return true;
  }
}

const isTrackMap = (value: unknown): value is LmuTrackMap => {
  const map = value as LmuTrackMap;
  return (
    map?.orientation === 'lmu-ccw-v1' &&
    !!map?.active?.inside &&
    map.active.trackPathPoints?.length >= MIN_RECORDED_POINTS &&
    map.startFinish?.direction === 'anticlockwise'
  );
};

export class LmuTrackMapStorage {
  private readonly store: JsonFileStore;

  constructor(filePath: string, log?: JsonFileStoreLogger) {
    this.store = new JsonFileStore(filePath, log);
  }

  restore(): Promise<void> {
    return this.store.restore();
  }

  flush(): Promise<void> {
    return this.store.flush();
  }

  close(): Promise<void> {
    return this.store.close();
  }

  load(trackName: string): LmuTrackMap | null {
    const map = this.store.get(trackName);
    return isTrackMap(map) ? map : null;
  }

  save(trackName: string, map: LmuTrackMap): void {
    this.store.set(trackName, map);
  }
}

export function loadLmuTrackMap(
  trackName: string,
  storage: LmuTrackMapStorage
): {
  map: LmuTrackMap;
  source: 'bundled' | 'storage';
} | null {
  const normalized = normalizeTrackName(trackName);
  const exact = normalized ? findExactBundledLmuTrackMap(normalized) : null;
  if (exact) return { map: exact, source: 'bundled' };

  const stored = storage.load(trackName);
  if (stored) return { map: stored, source: 'storage' };

  const partial = normalized ? findPartialBundledLmuTrackMap(normalized) : null;
  return partial ? { map: partial, source: 'bundled' } : null;
}
