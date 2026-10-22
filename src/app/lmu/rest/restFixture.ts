/**
 * Recorded LMU REST payloads, trimmed to the keys the tasks read.
 *
 * Sibling of ../rawFixture.ts. Shapes follow TinyPedal's adapter, which is the
 * only documentation of these endpoints that exists; the keys and nesting are
 * what matters, not the exact values.
 */

/** GET /rest/strategy/pitstop-estimate */
export const pitstopEstimateFixture = () => ({
  total: 32.5,
  damage: 12.25,
  // Real payloads carry more; kept so a parser that over-reaches is noticed.
  tires: 8.4,
  fuel: 6.1,
});

/** GET /rest/garage/UIScreen/RepairAndRefuel, a fuel car with litres. */
export const repairAndRefuelFixture = () => ({
  wearables: {
    body: { aero: 0.12 },
    brakes: [0.9, 0.88, 0.95, 0.94],
    suspension: [1, 1, 0.97, 1],
  },
  pitMenu: {
    pitMenu: [
      { name: 'TIRES:', currentSetting: 0, settings: [{ text: 'No Change' }] },
      {
        name: 'FUEL:',
        currentSetting: 2,
        settings: [{ text: '+0 L' }, { text: '+10 L' }, { text: '+45 L' }],
      },
    ],
  },
  fuelInfo: { maxVirtualEnergy: 100, maxFuel: 120 },
});

/** The same screen for an energy-limited car: the menu offers VE, not fuel. */
export const repairAndRefuelVirtualEnergyFixture = () => ({
  ...repairAndRefuelFixture(),
  pitMenu: {
    pitMenu: [
      { name: 'VIRTUAL ENERGY:', currentSetting: 78, settings: [] },
      {
        name: 'FUEL:',
        currentSetting: 1,
        settings: [{ text: '+0 L' }, { text: '+30 L' }],
      },
    ],
  },
});

/** GET /rest/sessions */
export const sessionsFixture = () => ({
  SESSSET_race_timescale: { currentValue: 6 },
  SESSSET_private_qual: { currentValue: 1 },
});

/** One forecast point, as LMU nests it. */
const node = (sky: number, temp: number, rainPercent: number) => ({
  WNV_SKY: { currentValue: sky },
  WNV_TEMPERATURE: { currentValue: temp },
  WNV_RAIN_CHANCE: { currentValue: rainPercent },
});

/** GET /rest/sessions/weather */
export const weatherFixture = () => ({
  PRACTICE: {
    START: node(1, 22, 0),
    NODE_25: node(1, 23, 10),
    NODE_50: node(2, 23, 25),
    NODE_75: node(3, 22, 60),
    FINISH: node(4, 21, 90),
  },
  QUALIFY: {
    START: node(1, 24, 5),
    NODE_25: node(1, 24, 5),
    NODE_50: node(1, 25, 5),
    NODE_75: node(1, 25, 10),
    FINISH: node(1, 24, 10),
  },
  RACE: {
    START: node(2, 20, 30),
    NODE_25: node(3, 19, 55),
    NODE_50: node(5, 18, 100),
    NODE_75: node(4, 18, 80),
    FINISH: node(2, 19, 40),
  },
});

/**
 * GET /rest/garage/UIScreen/TireManagement.
 *
 * Only the part that matters here: `compounds` is a list, and an entry's
 * position in it is the compound index per-wheel telemetry reports. The
 * optimal temperature rides along in the real payload and nothing reads it,
 * so it is kept to prove the parser ignores it rather than trips on it.
 */
export const tireManagementFixture = () => ({
  optimalCompoundConditions: {
    compounds: [
      { type: 'Hard', optimalTemperature: 85 },
      { type: 'Medium', optimalTemperature: 90 },
      { type: 'Soft', optimalTemperature: 95 },
      { type: 'Wet', optimalTemperature: 45 },
    ],
  },
  tireInventory: {
    maxAvailableTires: 20,
    bestConditionsUsed: [
      [0, 0],
      [1, 1],
    ],
  },
});

/**
 * GET /rest/garage/UIScreen/CarSetupOverview, trimmed from a real payload.
 *
 * The real one carries the whole setup -- a hundred-odd garageValues keys. The
 * three kept here are the ones that relate fuel to virtual energy, and they
 * are internally consistent on purpose: 23% at 0.83 L per percent is 19.1 L,
 * which is how the garage derives both figures from one slider.
 */
export const carSetupOverviewFixture = () => ({
  carSetup: {
    garageValues: {
      VM_FUEL_LEVEL: {
        key: 'VM_FUEL_LEVEL',
        stringValue: '0.83',
        lastSavedStringValue: '0.84',
        // The slider index, not the quantity -- deliberately different from
        // the number above so a parser reading the wrong field is noticed.
        value: 82,
        maxValue: 120,
        minValue: 0,
      },
      VM_FUEL_CAPACITY: {
        key: 'VM_FUEL_CAPACITY',
        stringValue: '19.1L (7.8 laps)',
        value: 0,
      },
      VM_VIRTUAL_ENERGY: {
        key: 'VM_VIRTUAL_ENERGY',
        stringValue: '23% (7.7 laps)',
        value: 23,
        maxValue: 101,
      },
    },
  },
});

/**
 * GET /rest/watch/standings, two entries trimmed to the keys the task reads.
 *
 * Values are from a captured payload, including the detail that matters: the
 * entry name carries the season ("Proton Competition 2026 #77:LM") where
 * `fullTeamName` does not. The live fields are kept on one entry as a reminder
 * that this body changes on every poll, which is why the task is slow.
 */
export const watchStandingsFixture = () => [
  {
    slotID: 5,
    driverName: 'jun lira',
    fullTeamName: 'Proton Competition',
    vehicleName: 'Proton Competition 2026 #77:LM',
    carNumber: '77',
    position: 3,
    focus: true,
    hasFocus: true,
    penalties: 0,
    carVelocity: { velocity: 33.6552619934082, x: 0.685, y: -0.136, z: -33.6 },
    timeIntoLap: 74.75196075439453,
  },
  {
    slotID: 8,
    driverName: 'Herve Attard',
    fullTeamName: 'Vista AF Corse',
    vehicleName: 'Vista AF Corse 2026 #21:LM',
    carNumber: '21',
    position: 4,
    focus: false,
    hasFocus: false,
    penalties: 1,
  },
];
