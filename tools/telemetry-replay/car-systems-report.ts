/**
 * Reports what a capture says about a car's adjustable systems.
 *
 * `npm run irsdk:inspect` answers questions about the tape - how many frames,
 * how many variables - not about the car in it. Populating
 * CAR_SYSTEM_LABEL_OVERRIDES needs the other half: which dc* channels this car
 * publishes, which way their scales run, and which of them actually moved while
 * the driver was working through the dials.
 *
 * Run over a capture recorded on Windows; the tape reader is plain Node, so
 * this works anywhere:
 *
 *   npx tsx tools/telemetry-replay/car-systems-report.ts \
 *     --input telemetry-captures/carsystems-dallarap217.irdt
 *
 * Every dc* variable in the tape is reported, not only the catalogue's, so a
 * channel nobody has thought to look for still shows up.
 */
import path from 'node:path';
import * as yaml from 'js-yaml';
import { CAR_SYSTEM_ADJUSTMENTS } from '../../src/types/carSystems';
import { TapeReader } from './tape';
import {
  validateReplay,
  type ReplayProbe,
  type TelemetryFrame,
} from './validator';

interface ChannelStats {
  frames: number;
  min: number;
  max: number;
  /** Capped: a channel with hundreds of distinct values is a live readout. */
  distinct: Set<number>;
  sawNegative: boolean;
}

const DISTINCT_CAP = 64;

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'number' && Number.isFinite(first)) return first;
  }
  return undefined;
};

const asBoolean = (value: unknown): boolean =>
  value === true || (Array.isArray(value) && value[0] === true);

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

/**
 * Matches CarSystemsProcessor's own definition, so the report describes the
 * same frames the widget would have learned from. Out of the car iRacing
 * publishes a reduced set, and counting those frames would understate which
 * channels the car really has.
 */
const isInCar = (frame: TelemetryFrame): boolean =>
  (asBoolean(frame.IsOnTrack) ||
    asBoolean(frame.PlayerCarInPitStall) ||
    asBoolean(frame.OnPitRoad)) &&
  !asBoolean(frame.IsInGarage) &&
  !asBoolean(frame.IsReplayPlaying);

const main = async (): Promise<void> => {
  const input = arg('input');
  if (!input) {
    console.error(
      'Usage: npx tsx tools/telemetry-replay/car-systems-report.ts --input <tape.irdt>'
    );
    process.exitCode = 1;
    return;
  }

  const tapePath = path.resolve(input);

  // Read the variable list first: the probe has to declare what it wants, and
  // what we want is "whatever dc* this tape happens to carry".
  const reader = await TapeReader.open(tapePath);
  const dcNames = [...reader.schema.variables.keys()]
    .filter((name) => name.startsWith('dc'))
    .sort();
  // Only the gate variables this tape actually carries: validateReplay throws
  // on a probe asking for a name the schema does not have.
  const gate = [
    'IsOnTrack',
    'PlayerCarInPitStall',
    'OnPitRoad',
    'IsInGarage',
    'IsReplayPlaying',
  ].filter((name) => reader.schema.variables.has(name));
  await reader.close();

  if (dcNames.length === 0) {
    console.error('No dc* variables in this tape - was it recorded in-car?');
    process.exitCode = 1;
    return;
  }

  const stats = new Map<string, ChannelStats>();
  let inCarFrames = 0;
  let carPath: string | undefined;
  let carName: string | undefined;

  const probe: ReplayProbe<null> = {
    name: 'car-systems-report',
    schemaVersion: 1,
    variables: [...dcNames, ...gate],
    onSessionInfo(text) {
      try {
        const session = yaml.load(text, { json: true }) as {
          DriverInfo?: {
            DriverCarIdx?: number;
            Drivers?: {
              CarIdx?: number;
              CarPath?: string;
              CarScreenName?: string;
            }[];
          };
        };
        const info = session?.DriverInfo;
        const player = info?.Drivers?.find(
          (driver) => driver.CarIdx === info?.DriverCarIdx
        );
        if (player?.CarPath) carPath = player.CarPath;
        if (player?.CarScreenName) carName = player.CarScreenName;
      } catch {
        // A truncated final YAML revision is not worth failing the report over.
      }
    },
    onFrame(frame) {
      if (!isInCar(frame)) return null;
      inCarFrames += 1;

      for (const name of dcNames) {
        const value = asNumber(frame[name]);
        if (value === undefined) continue;
        let entry = stats.get(name);
        if (!entry) {
          entry = {
            frames: 0,
            min: value,
            max: value,
            distinct: new Set(),
            sawNegative: false,
          };
          stats.set(name, entry);
        }
        entry.frames += 1;
        if (value < entry.min) entry.min = value;
        if (value > entry.max) entry.max = value;
        if (value < 0) entry.sawNegative = true;
        if (entry.distinct.size < DISTINCT_CAP) entry.distinct.add(value);
      }
      return null;
    },
  };

  await validateReplay({ path: tapePath, probes: [probe] });

  const known = new Set(CAR_SYSTEM_ADJUSTMENTS.map((d) => d.key));
  const rows = [...stats.entries()].sort(([a], [b]) => a.localeCompare(b));

  console.log(`\nCapture   ${path.basename(tapePath)}`);
  console.log(`Car       ${carName ?? '(unknown)'}`);
  console.log(
    `CarPath   ${carPath ?? '(unknown)'}   <- the override table key`
  );
  console.log(`In-car    ${inCarFrames} frames\n`);

  if (rows.length === 0) {
    console.log('No dc* channel carried a value on an in-car frame.\n');
    return;
  }

  const header = [
    'channel',
    'min',
    'max',
    'steps',
    'moved',
    'signed',
    'catalogue',
  ];
  const body = rows.map(([name, entry]) => {
    const moved = entry.distinct.size > 1;
    const capped = entry.distinct.size >= DISTINCT_CAP;
    return [
      name,
      String(entry.min),
      String(entry.max),
      capped ? `${DISTINCT_CAP}+` : String(entry.distinct.size),
      // The column that matters: a channel that never moved was never swept,
      // so its range here is one sample and proves nothing about its scale.
      moved ? 'yes' : 'NO',
      entry.sawNegative ? 'yes' : '-',
      known.has(name) ? '' : 'NEW',
    ];
  });

  const widths = header.map((label, column) =>
    Math.max(label.length, ...body.map((row) => row[column].length))
  );
  const line = (cells: string[]) =>
    cells.map((cell, column) => cell.padEnd(widths[column])).join('  ');

  console.log(line(header));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of body) console.log(line(row));

  const unswept = body.filter((row) => row[4] === 'NO').map((row) => row[0]);
  if (unswept.length > 0) {
    console.log(`\nNever moved, so range is unproven: ${unswept.join(', ')}`);
  }
  const novel = body.filter((row) => row[6] === 'NEW').map((row) => row[0]);
  if (novel.length > 0) {
    console.log(`Not in the catalogue: ${novel.join(', ')}`);
  }
  console.log();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
