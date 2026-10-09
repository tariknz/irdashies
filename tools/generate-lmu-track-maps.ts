import fs from 'node:fs';
import path from 'node:path';
import { parseTinyPedalTrackMap } from '../src/app/irsdk/lmu/trackMap';
import trackDataBundle from '../src/frontend/assets/data/tracks-bundle.json';

interface LovelyTurn {
  name?: string;
  start?: number;
  end?: number;
  marker?: number;
}

interface LovelyTrack {
  turn?: LovelyTurn[];
}

const TRACK_DATA_IDS: Record<string, string> = {
  'Algarve International Circuit': 'algarve gp',
  'Autodromo Enzo e Dino Ferrari': 'imola gp',
  'Autodromo Nazionale Monza': 'monza full',
  'Autódromo José Carlos Pace': 'interlagos gp',
  'Circuit de Barcelona': 'barcelona gp',
  'Circuit de la Sarthe': 'lemans full',
  'Circuit de la Sarthe Mulsanne': 'lemans nochicane',
  'Circuit de Spa-Francorchamps': 'spa 2024 combined',
  'Circuit of the Americas': 'cota-gp',
  'Daytona International Speedway Road Course': 'daytona 2011 road',
  'Sebring International Raceway': 'sebring international',
  'Silverstone Grand Prix Circuit - WEC': 'silverstone 2019 gp',
  'WeatherTech Raceway Laguna Seca': 'lagunaseca',
};

const inputDirectory = process.argv[2];
if (!inputDirectory) {
  throw new Error('Usage: tsx tools/generate-lmu-track-maps.ts <trackmap-dir>');
}

const outputPath = path.join(
  process.cwd(),
  'src',
  'app',
  'irsdk',
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

  const lovelyTurns = trackData[TRACK_DATA_IDS[title]]?.turn;
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
