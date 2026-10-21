import fs from 'node:fs';
import path from 'node:path';
import { parseTinyPedalTrackMap } from '../src/app/lmu/trackMap';
import trackDataBundle from '../src/frontend/assets/data/tracks-bundle.json';
import { LMU_TRACK_DATA_IDS } from '../src/types/lmuTrackAliases';

interface LovelyTurn {
  name?: string;
  start?: number;
  end?: number;
  marker?: number;
}

interface LovelyTrack {
  turn?: LovelyTurn[];
}

const inputDirectory = process.argv[2];
if (!inputDirectory) {
  throw new Error('Usage: tsx tools/generate-lmu-track-maps.ts <trackmap-dir>');
}

// The LMU source moved out of the iRacing SDK directory; this path followed
// it late, so a run before this wrote where nothing reads.
const outputPath = path.join(
  process.cwd(),
  'src',
  'app',
  'lmu',
  'lmu-track-maps.json'
);
const trackData = (
  trackDataBundle as unknown as {
    tracks: Record<string, LovelyTrack>;
  }
).tracks;

const result: Record<string, ReturnType<typeof parseTinyPedalTrackMap>> = {};
const failures: string[] = [];

for (const fileName of fs
  .readdirSync(inputDirectory)
  .filter((name) => path.extname(name).toLowerCase() === '.svg')
  .sort()) {
  const svg = fs.readFileSync(path.join(inputDirectory, fileName), 'utf8');
  const map = parseTinyPedalTrackMap(svg);
  const title = svg.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!map || !title) {
    failures.push(fileName);
    continue;
  }

  const lovelyTurns = trackData[LMU_TRACK_DATA_IDS[title]]?.turn;
  if (lovelyTurns?.length) {
    map.turns = lovelyTurns.flatMap((turn, index) => {
      const progress =
        turn.marker ??
        (turn.start !== undefined && turn.end !== undefined
          ? (turn.start + turn.end) / 2
          : undefined);
      if (progress === undefined) return [];

      const pointIndex =
        Math.round(progress * map.active.trackPathPoints.length) %
        map.active.trackPathPoints.length;
      const point = map.active.trackPathPoints[pointIndex];
      const number = String(index + 1);
      const labels = [{ ...point, content: number }];
      if (
        turn.name &&
        !new RegExp(`^(?:t|turn\\s*)${number}$`, 'i').test(turn.name.trim())
      ) {
        labels.push({ ...point, content: turn.name });
      }
      return labels;
    });
  }

  result[title] = map;
}

fs.writeFileSync(outputPath, JSON.stringify(result));
console.log(
  `Generated ${Object.keys(result).length} maps; ${failures.length} failures`
);
if (failures.length) console.log(failures.join('\n'));
