/**
 * A made-up iRacePlan planning response for tests: a 24h team race with six
 * drivers and 23 stints, a double stint, a stint with no driver yet and
 * availability windows. No real people.
 */
export const FIXTURE_PLANNING_ID = 9001;
export const FIXTURE_STRATEGY_ID = 7001;
export const FIXTURE_DRIVER_IDS = [101, 102, 103, 104, 105, 106];
export const FIXTURE_RACE_START = '2030-06-01T12:00:00Z';

const RACE_START_MS = Date.parse(FIXTURE_RACE_START);
const STINT_MS = 61 * 60_000;
const PIT_MS = 50_000;

const iso = (ms: number) => new Date(ms).toISOString();

const driver = (index: number) => ({
  iracing_id: FIXTURE_DRIVER_IDS[index],
  name: `Driver ${String.fromCharCode(65 + index)}`,
});

/** Driver index per stint: stints 2 and 3 are a double stint; 23 has none. */
const ROTATION: (number | null)[] = [
  0,
  1,
  1,
  ...Array.from({ length: 19 }, (_, i) => (i + 2) % 6),
  null,
];

export function rawPlanningFixture() {
  return {
    planning: {
      id: FIXTURE_PLANNING_ID,
      session: {
        start_at: '2030-06-01T11:00:00.000Z',
        end_at: '2030-06-02T12:00:00.000Z',
        name: 'Test 24',
      },
      car: 'Test Car',
      registrable: { iracing_id: 5001, name: 'Test Team' },
      track: { iracing_id: 166, name: 'Test Circuit' },
      roster_size: 6,
      type: 'team',
      created_at: '2030-05-01T10:00:00.000Z',
      updated_at: '2030-05-01T10:00:00.000Z',
      roster: FIXTURE_DRIVER_IDS.map((_, i) => driver(i)),
      strategies: [
        {
          id: FIXTURE_STRATEGY_ID,
          name: 'Main',
          status: 'up-to-date',
          fuel_capacity: 36,
          pit_stop_time: PIT_MS,
          race_start_at: FIXTURE_RACE_START,
          drivers: FIXTURE_DRIVER_IDS.map((_, i) => ({
            ...driver(i),
            average_lap_time_dry: 107_000 + i * 200,
            average_lap_time_wet: i === 0 ? 121_000 : null,
            average_fuel_consumption_dry: 1.05,
            average_fuel_consumption_wet: 0,
            stint_count: 4,
          })),
          stints: ROTATION.map((driverIndex, i) => {
            const start = RACE_START_MS + i * (STINT_MS + PIT_MS);
            return {
              number: i + 1,
              driver: driverIndex === null ? null : driver(driverIndex),
              start_at: iso(start),
              end_at: iso(start + STINT_MS),
              duration_minutes: 61,
              setup: 'dry',
              estimated_laps: 34,
              pinned_laps: i === 0 ? 33 : null,
              fuel_consumption: 35.7,
              pit_fuel_capacity: 36,
              locked: i === 0,
              spotter: null,
            };
          }),
          created_at: '2030-05-02T10:00:00.000Z',
          updated_at: '2030-05-02T12:00:00.000Z',
        },
      ],
      driver_availabilities: FIXTURE_DRIVER_IDS.map((_, i) => ({
        driver: driver(i),
        periods: [
          {
            id: i * 10 + 1,
            status: 'available',
            start_time: '2030-06-01T11:00:00Z',
            end_time: '2030-06-01T22:00:00Z',
            notes: '',
          },
          {
            id: i * 10 + 2,
            status: i % 2 === 0 ? 'unavailable' : 'maybe',
            start_time: '2030-06-01T22:00:00Z',
            end_time: '2030-06-02T04:00:00Z',
            notes: null,
          },
        ],
      })),
      result: null,
    },
  };
}
