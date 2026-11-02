import fs from 'node:fs';
import path from 'node:path';
import type { LmuTrackMap } from '@irdashies/types';
import bundledTrackMaps from './lmu-track-maps.json';

const WIDTH = 1920;
const HEIGHT = 1080;
const MARGIN = 80;
const RESAMPLED_POINTS = 512;
const MIN_RECORDED_POINTS = 20;

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
  lapStartET?: number;
  lapInvalidated?: boolean;
  pos?: ArrayLike<number>;
  vehLapDistPct: ArrayLike<number>;
  vehLastLapTime: ArrayLike<number>;
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
  distance: number
): RecordedPoint {
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

export function normalizeLmuTrackMap(
  recorded: readonly RecordedPoint[],
  trackLength: number
): LmuTrackMap {
  const points = Array.from({ length: RESAMPLED_POINTS }, (_, index) =>
    rotateLmuMapPointCounterClockwise(
      interpolatePoint(recorded, (trackLength * index) / RESAMPLED_POINTS)
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

export function findBundledLmuTrackMap(trackName: string): LmuTrackMap | null {
  const normalized = normalizeTrackName(trackName);
  if (!normalized) return null;
  const maps = bundledTrackMaps as unknown as Record<string, LmuTrackMap>;
  const exactTitle = Object.keys(maps).find(
    (title) => normalizeTrackName(title) === normalized
  );
  const alias = BUNDLED_LMU_ALIASES[normalized];
  const partialTitle = Object.keys(maps)
    .filter((title) => {
      const candidate = normalizeTrackName(title);
      return candidate.includes(normalized) || normalized.includes(candidate);
    })
    .sort(
      (a, b) => normalizeTrackName(b).length - normalizeTrackName(a).length
    )[0];
  return maps[exactTitle ?? alias ?? partialTitle] ?? null;
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

export function findTinyPedalTrackMap(
  trackName: string,
  directories: readonly string[]
): { map: LmuTrackMap; filePath: string } | null {
  const normalizedTrackName = normalizeTrackName(trackName);
  for (const directory of directories) {
    let fileNames: string[];
    try {
      fileNames = fs.readdirSync(directory);
    } catch {
      continue;
    }
    const fileName = fileNames.find(
      (name) =>
        path.extname(name).toLowerCase() === '.svg' &&
        normalizeTrackName(path.basename(name, path.extname(name))) ===
          normalizedTrackName
    );
    if (!fileName) continue;

    const filePath = path.join(directory, fileName);
    try {
      const map = parseTinyPedalTrackMap(fs.readFileSync(filePath, 'utf8'));
      if (map) return { map, filePath };
    } catch {
      continue;
    }
  }
  return null;
}

export function tinyPedalTrackMapDirectories(): string[] {
  const configured = process.env.TINYPEDAL_TRACKMAP_DIR;
  if (process.platform !== 'win32') {
    return configured ? [configured] : [];
  }
  const drives = Array.from({ length: 24 }, (_, index) =>
    path.join(`${String.fromCharCode(67 + index)}:\\`, 'TinyPedal', 'trackmap')
  );
  return configured ? [configured, ...drives] : drives;
}

export class LmuTrackMapRecorder {
  private trackName = '';
  private lapStartET: number | null = null;
  private recording = false;
  private points: RecordedPoint[] = [];

  update(frame: LmuMapFrame): LmuTrackMap | null {
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

    const progress = frame.vehLapDistPct[frame.playerVehicleIdx];
    if (!finite(progress)) return null;

    if (this.lapStartET === null) {
      this.lapStartET = frame.lapStartET;
      this.recording = progress <= 0.02;
    } else if (frame.lapStartET > this.lapStartET) {
      const completed = this.finishLap(
        frame.lapDist,
        frame.vehLastLapTime[frame.playerVehicleIdx]
      );
      this.lapStartET = frame.lapStartET;
      this.recording = true;
      this.points = [];
      this.sample(frame, progress);
      return completed;
    }

    if (!this.recording) return null;
    this.sample(frame, progress);
    return null;
  }

  reset(trackName = ''): void {
    this.trackName = trackName;
    this.lapStartET = null;
    this.recording = false;
    this.points = [];
  }

  private sample(frame: LmuMapFrame, progress: number): void {
    if (!frame.pos) return;
    const position = lmuGroundPosition(frame.pos);
    const distance = progress * frame.lapDist;
    const previous = this.points[this.points.length - 1];
    if (
      !position ||
      distance < 0 ||
      (previous && distance <= previous.distance)
    )
      return;
    this.points.push({ ...position, distance });
  }

  private finishLap(
    trackLength: number,
    lastLapTime: number
  ): LmuTrackMap | null {
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    if (
      !finite(lastLapTime) ||
      lastLapTime <= 0 ||
      this.points.length < MIN_RECORDED_POINTS ||
      !first ||
      !last
    ) {
      return null;
    }
    return normalizeLmuTrackMap(this.points, trackLength);
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
  constructor(private readonly filePath: string) {}

  load(trackName: string): LmuTrackMap | null {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<
        string,
        unknown
      >;
      return isTrackMap(data[trackName]) ? data[trackName] : null;
    } catch {
      return null;
    }
  }

  save(trackName: string, map: LmuTrackMap): void {
    let data: Record<string, LmuTrackMap>;
    try {
      const parsed: unknown = JSON.parse(
        fs.readFileSync(this.filePath, 'utf8')
      );
      data =
        parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, LmuTrackMap>)
          : {};
    } catch {
      data = {};
    }
    data[trackName] = map;
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(data));
    fs.renameSync(temporaryPath, this.filePath);
  }
}

export function loadLmuTrackMap(
  trackName: string,
  storage: LmuTrackMapStorage,
  tinyPedalDirectories: readonly string[]
): {
  map: LmuTrackMap;
  source: 'storage' | 'bundled' | 'tinyPedal';
  filePath?: string;
} | null {
  const stored = storage.load(trackName);
  if (stored) return { map: stored, source: 'storage' };

  const bundled = findBundledLmuTrackMap(trackName);
  if (bundled) return { map: bundled, source: 'bundled' };

  const imported = findTinyPedalTrackMap(trackName, tinyPedalDirectories);
  return imported
    ? { map: imported.map, source: 'tinyPedal', filePath: imported.filePath }
    : null;
}
