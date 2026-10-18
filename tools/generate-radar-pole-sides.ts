import { readFileSync, writeFileSync, existsSync } from 'fs';

/**
 * Builds src/types/radarPoleSides.json: for every track drawing, which side
 * the pole line of a pace field is on, taken as the inside of the first
 * corner after the start/finish line.
 *
 * A corner is the first stretch where the heading turns 35 degrees or more
 * within 3% of a lap, so the rule does not need the track length. Entries a
 * person confirmed by driving ("verified"), users' corrections
 * ("reported") and the `trackNames` exceptions are
 * kept as they are; everything else is recomputed.
 *
 * Regenerate with: npm run generate-radar-pole-sides
 */

const TRACKS_FILE = './src/frontend/domain/track/tracks/tracks.json';
const OUTPUT_FILE = './src/types/radarPoleSides.json';

const SAMPLES = 1500;
/** Chord used to read the heading, as a share of the lap. */
const CHORD = 0.004;
/** Window the turn is measured over, as a share of the lap. */
const WINDOW = 0.03;
/** Heading change in the window that makes a corner, in degrees. */
const CORNER_DEG = 35;
/** Only the first part of the lap is searched. */
const SEARCH = 0.5;

interface Drawing {
  active: {
    trackPathPoints: { x: number; y: number }[];
    totalLength: number;
  };
  startFinish?: {
    direction?: 'clockwise' | 'anticlockwise' | null;
    point?: { length?: number };
  };
}

interface Entry {
  poleLeft: boolean;
  source: 'geometry' | 'verified' | 'reported';
}

/** Points along the lap from the start/finish line, in the direction of travel. */
const lapPoints = (drawing: Drawing) => {
  const { trackPathPoints: points, totalLength } = drawing.active;
  const sf = drawing.startFinish?.point?.length;
  if (sf === undefined || points.length < 2 || !(totalLength > 0)) return null;
  const forward = drawing.startFinish?.direction === 'anticlockwise';
  return Array.from({ length: SAMPLES }, (_, k) => {
    const along = (k / SAMPLES) * totalLength;
    const length = forward
      ? (sf + along) % totalLength
      : (sf - along + totalLength) % totalLength;
    const float = (length / totalLength) * (points.length - 1);
    const i = Math.floor(float);
    const j = Math.min(i + 1, points.length - 1);
    const t = float - i;
    return {
      x: points[i].x + (points[j].x - points[i].x) * t,
      y: points[i].y + (points[j].y - points[i].y) * t,
    };
  });
};

/** True when the first corner turns left. Drawings are y-down, so a positive heading change is a right turn. */
export const firstCornerIsLeft = (drawing: Drawing): boolean | null => {
  const pts = lapPoints(drawing);
  if (!pts) return null;
  const chord = Math.max(1, Math.round(SAMPLES * CHORD));
  const heading = pts.map((a, i) => {
    const b = pts[(i + chord) % SAMPLES];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
  const unwrapped = [heading[0]];
  for (let i = 1; i < SAMPLES; i += 1) {
    const step =
      ((heading[i] - heading[i - 1] + Math.PI) % (2 * Math.PI)) - Math.PI;
    unwrapped.push(
      unwrapped[i - 1] + (step < -Math.PI ? step + 2 * Math.PI : step)
    );
  }
  const window = Math.max(2, Math.round(SAMPLES * WINDOW));
  for (let i = window; i < SAMPLES * SEARCH; i += 1) {
    const degrees = ((unwrapped[i] - unwrapped[i - window]) * 180) / Math.PI;
    if (Math.abs(degrees) >= CORNER_DEG) return degrees < 0;
  }
  return null;
};

const main = () => {
  const drawings = JSON.parse(readFileSync(TRACKS_FILE, 'utf8')) as Record<
    string,
    Drawing
  >;
  const previous = existsSync(OUTPUT_FILE)
    ? JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))
    : { tracks: {}, trackNames: {} };
  const tracks: Record<string, Entry> = {};
  let skipped = 0;
  for (const id of Object.keys(drawings).sort(
    (a, b) => Number(a) - Number(b)
  )) {
    const kept = previous.tracks?.[id];
    if (kept?.source === 'verified' || kept?.source === 'reported') {
      tracks[id] = kept;
      continue;
    }
    let left: boolean | null;
    try {
      left = firstCornerIsLeft(drawings[id]);
    } catch {
      left = null;
    }
    if (left === null) {
      skipped += 1;
      continue;
    }
    tracks[id] = { poleLeft: left, source: 'geometry' };
  }
  // Verified ids that have no drawing still stay.
  for (const [id, kept] of Object.entries<Entry>(previous.tracks ?? {})) {
    if (kept.source === 'verified' || kept.source === 'reported') {
      tracks[id] = kept;
    }
  }
  const sorted = Object.fromEntries(
    Object.entries(tracks).sort(([a], [b]) => Number(a) - Number(b))
  );
  const output = {
    version: 1,
    tracks: sorted,
    trackNames: previous.trackNames ?? {},
  };
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(
    `${Object.keys(sorted).length} tracks written, ${skipped} without a clear first corner`
  );
};

if (process.argv[1]?.includes('generate-radar-pole-sides')) main();
