import fs from 'node:fs';
import path from 'node:path';
import {
  LmuBundledTrackGeometry,
  parseTrackGeometryEntry,
} from '../src/app/lmu/bundledTrackGeometry';
import { LMU_TRACK_DATA_IDS } from '../src/types/lmu/trackAliases';
import {
  renderLmuTrackSvg,
  trackSvgFileName,
  type TrackTurn,
} from './lmu-track-svg';

const usage =
  'Usage: npm run lmu:track-svgs -- [--bundle <lmu-track-geometry.json>] [--out <folder>] [--track <name>]...';

const args = process.argv.slice(2);
let bundlePath = path.join(
  process.cwd(),
  'src',
  'app',
  'lmu',
  'lmu-track-geometry.json'
);
let outputDirectory = path.join(process.cwd(), 'out', 'lmu-track-svgs');
const onlyTracks: string[] = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--bundle') bundlePath = path.resolve(args[++index] ?? '');
  else if (arg === '--out') outputDirectory = path.resolve(args[++index] ?? '');
  else if (arg === '--track') onlyTracks.push(args[++index] ?? '');
  else {
    console.error(usage);
    process.exit(1);
  }
}

interface TurnSource {
  tracks: Record<string, { turn?: TrackTurn[] }>;
}

const readJson = (file: string): unknown =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;

const raw = readJson(bundlePath) as {
  tracks?: Record<string, unknown>;
};
const bundle = new LmuBundledTrackGeometry(raw);
const dataDirectory = path.join(
  process.cwd(),
  'src',
  'frontend',
  'assets',
  'data'
);
const lmuTurns = readJson(
  path.join(dataDirectory, 'lmu-tracks-bundle.json')
) as TurnSource;
const iracingTurns = readJson(
  path.join(dataDirectory, 'tracks-bundle.json')
) as TurnSource;

const turnsFor = (trackName: string): TrackTurn[] => {
  const own = lmuTurns.tracks[trackName.toLowerCase()]?.turn;
  if (own?.length) return own;
  const alias = LMU_TRACK_DATA_IDS[trackName];
  return (alias ? iracingTurns.tracks[alias]?.turn : undefined) ?? [];
};

const names = Object.keys(raw.tracks ?? {})
  .filter((name) => onlyTracks.length === 0 || onlyTracks.includes(name))
  .sort();
if (names.length === 0) {
  console.error(
    onlyTracks.length
      ? `No bundled track named ${onlyTracks.join(', ')}`
      : 'The bundle has no tracks'
  );
  process.exit(1);
}

const namesByFile = new Map<string, string[]>();
for (const trackName of names) {
  const file = trackSvgFileName(trackName);
  namesByFile.set(file, [...(namesByFile.get(file) ?? []), trackName]);
}
const collisions = [...namesByFile].filter(([, shared]) => shared.length > 1);
if (collisions.length > 0) {
  for (const [file, shared] of collisions) {
    console.error(`${shared.join(' and ')} would both be written to ${file}`);
  }
  process.exit(1);
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const trackName of names) {
  const geometry = parseTrackGeometryEntry(raw.tracks?.[trackName]);
  if (!geometry) {
    console.log(`${trackName}: skipped, the entry does not parse`);
    continue;
  }
  const result = renderLmuTrackSvg({
    trackName,
    geometry,
    sectors: bundle.sectorBoundaries(trackName),
    turns: turnsFor(trackName),
  });
  const file = path.join(outputDirectory, trackSvgFileName(trackName));
  fs.writeFileSync(file, result.svg);
  console.log(
    `${trackName}: ${path.relative(process.cwd(), file)} (${
      result.hasWidth
        ? `learned edges, median ${result.medianWidthM?.toFixed(1)} m${result.unknownBins ? `, ${result.unknownBins} stretches unknown` : ''}`
        : 'shape only'
    }, ${result.labels} corner labels, ${result.sizeM[0]} x ${result.sizeM[1]} m)`
  );
}
