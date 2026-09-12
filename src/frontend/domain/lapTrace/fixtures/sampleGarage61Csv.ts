/**
 * Synthetic Garage 61 CSV export shared by the parser spec and a Storybook
 * story. A small circular GPS loop (~2000 m circumference) with one clear
 * brake-on/off and throttle-on transition, a gear change, one ABS-active
 * sample, and two rows continuing past the start/finish line — enough to
 * exercise every code path in parseGarage61Csv without committing a large
 * real sample file to the repo.
 */

const LAT0 = 36.15;
const LON0 = 139.919;
const METRES_PER_DEGREE_LAT = 111_320;
const TARGET_CIRCUMFERENCE_M = 2000;
const RADIUS_LAT_DEG =
  TARGET_CIRCUMFERENCE_M / (2 * Math.PI) / METRES_PER_DEGREE_LAT;
const RADIUS_LON_DEG =
  TARGET_CIRCUMFERENCE_M /
  (2 * Math.PI) /
  (METRES_PER_DEGREE_LAT * Math.cos((LAT0 * Math.PI) / 180));

const MAIN_ROWS = 38;
const START_PCT = 0.0004;
const END_PCT = 0.999;
/** Continue past the line for position purposes; the stored column wraps. */
const WRAP_ROWS_RAW_PCT = [1.0002, 1.0006];

interface SampleRow {
  /** Unwrapped — may exceed 1; drives position around the loop. */
  pctRaw: number;
  throttle: number;
  brake: number;
  speed: number;
  gear: number;
  absActive: boolean;
}

function buildRows(): SampleRow[] {
  const rows: SampleRow[] = [];
  const step = (END_PCT - START_PCT) / (MAIN_ROWS - 1);

  for (let i = 0; i < MAIN_ROWS; i++) {
    // A single braking zone roughly a third of the way round: speed dips,
    // brake comes on then off, throttle comes back on afterwards.
    const inBrakeZone = i >= 12 && i <= 16;
    const inThrottleZone = i > 16 && i <= 20;
    rows.push({
      pctRaw: START_PCT + i * step,
      throttle: inBrakeZone ? 0 : inThrottleZone ? 0.8 : 1,
      brake: inBrakeZone ? 0.8 : 0,
      speed: inBrakeZone ? 18 : i > 20 ? 45 : 40,
      gear: i < 14 ? 5 : 3,
      absActive: i === 14,
    });
  }

  for (const pctRaw of WRAP_ROWS_RAW_PCT) {
    rows.push({
      pctRaw,
      throttle: 1,
      brake: 0,
      speed: 42,
      gear: 4,
      absActive: false,
    });
  }

  return rows;
}

function toCsvRow(row: SampleRow): string {
  const angle = 2 * Math.PI * row.pctRaw;
  const lat = LAT0 + RADIUS_LAT_DEG * Math.sin(angle);
  const lon = LON0 + RADIUS_LON_DEG * Math.cos(angle);
  const pct = row.pctRaw % 1;

  return [
    row.speed.toFixed(3),
    pct.toFixed(7),
    lat.toFixed(7),
    lon.toFixed(7),
    row.brake.toFixed(3),
    row.throttle.toFixed(3),
    '6000', // RPM — unused by the importer
    '0', // SteeringWheelAngle — unused
    row.gear.toString(),
    '1', // Clutch — unused
    row.absActive ? 'true' : 'false',
    'false', // DRSActive — unused
    '0',
    '0',
    '0',
    '0',
    '0', // LatAccel/LongAccel/VertAccel/Yaw/YawRate — unused
    '3', // PositionType — unused
  ].join(',');
}

const HEADER =
  'Speed,LapDistPct,Lat,Lon,Brake,Throttle,RPM,SteeringWheelAngle,Gear,Clutch,ABSActive,DRSActive,LatAccel,LongAccel,VertAccel,Yaw,YawRate,PositionType';

export const sampleGarage61Csv = [HEADER, ...buildRows().map(toCsvRow)].join(
  '\n'
);

/** A filename following Garage 61's real export convention. */
export const sampleGarage61FileName =
  'Garage 61 - Test Driver - Test Car - Test Track (Full) - 01.00.895 - 01TESTULID12345678901234.csv';
