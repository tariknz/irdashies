import type {
  PitEstimateSource,
  PitRuleFamily,
  PitServiceRule,
} from '@irdashies/types';

/**
 * 26S4 pit regulations. Times are for a full tank and four tyres. Rows follow
 * the regulations table; `carIds` are exact iRacing `CarPath` values, taken
 * from the Lovely car data (src/frontend/assets/data/cars-bundle.json). A car
 * with no row gets no table values and relies on learned data. Empty rows are
 * cars the Lovely data does not have yet.
 */
interface TableRow {
  id: string;
  /** The row's label in the regulations table. */
  name: string;
  fullTankSeconds: number;
  fourTyreSeconds: number;
  carIds: readonly string[];
  /** NEC changes the fill time for these rows only. */
  nec?: boolean;
  /** DTM applies to these rows only. */
  dtm?: boolean;
}

const NEC_FULL_TANK_SECONDS = 120;
const DTM_FULL_TANK_SECONDS = 40;
const DTM_FOUR_TYRE_SECONDS = 7;
/** Stopping to service start plus the hold before release, until learned. */
export const DEFAULT_STOP_OVERHEAD_SECONDS = 2.5;

export const PIT_TABLE_ROWS: readonly TableRow[] = [
  {
    id: 'gtp',
    name: 'GTP / Hypercar',
    fullTankSeconds: 40,
    fourTyreSeconds: 20,
    carIds: [
      'acuraarx06gtp',
      'amvalkyriegtp',
      'bmwlmdh',
      'cadillacvseriesrgtp',
      'ferrari499p',
      'porsche963gtp',
    ],
  },
  {
    id: 'lmp2',
    name: 'Dallara P217 (LMP2)',
    fullTankSeconds: 40,
    fourTyreSeconds: 20,
    carIds: ['dallarap217'],
  },
  {
    id: 'lmp3',
    name: 'Ligier JS P320 (LMP3)',
    fullTankSeconds: 40,
    fourTyreSeconds: 20,
    carIds: ['ligierjsp320'],
  },
  {
    id: 'gt3',
    name: 'GT3 Class (inc. Legacy)',
    fullTankSeconds: 40,
    fourTyreSeconds: 20,
    carIds: [
      'acuransxevo22gt3',
      'amvantageevogt3',
      'audir8lmsevo2gt3',
      'bmwm4gt3',
      'chevyvettez06rgt3',
      'ferrari296gt3',
      'fordmustanggt3',
      'lamborghinievogt3',
      'mclaren720sgt3',
      'mclarenmp4',
      'mercedesamgevogt3',
      'porsche992rgt3',
    ],
    nec: true,
    dtm: true,
  },
  {
    id: 'porscheCup',
    name: 'Porsche 911 Cup (all variants)',
    fullTankSeconds: 44,
    fourTyreSeconds: 20,
    carIds: ['porsche992cup', 'porsche9922cup'],
    nec: true,
  },
  {
    id: 'rufCSpec',
    name: 'Ruf RT 12R C-Spec',
    fullTankSeconds: 44,
    fourTyreSeconds: 20,
    carIds: [],
    nec: true,
  },
  {
    id: 'ferrari296Challenge',
    name: 'Ferrari 296 Challenge',
    fullTankSeconds: 53,
    fourTyreSeconds: 20,
    carIds: ['ferrari296challenge'],
    nec: true,
  },
  {
    id: 'ctsv',
    name: 'Cadillac CTS-V',
    fullTankSeconds: 48,
    fourTyreSeconds: 35,
    carIds: ['cadillacctsvr'],
    nec: true,
  },
  {
    id: 'kiaOptima',
    name: 'Kia Optima',
    fullTankSeconds: 48,
    fourTyreSeconds: 36,
    carIds: [],
    nec: true,
  },
  {
    id: 'gt4',
    name: 'GT4 Class (inc. Legacy)',
    fullTankSeconds: 48,
    fourTyreSeconds: 35,
    carIds: [
      'amvantagegt4',
      'bmwm4evogt4',
      'bmwm4gt4',
      'fordmustanggt4',
      'mclaren570sgt4',
      'mercedesamggt4',
      'porsche718gt4',
    ],
    nec: true,
  },
  {
    id: 'tcr',
    name: 'TCR Class (inc. Legacy)',
    fullTankSeconds: 52,
    fourTyreSeconds: 40,
    carIds: [
      'audirs3lms',
      'audirs3lmsgen2',
      'hondacivictyper',
      'hyundaielantracn7',
      'hyundaivelostern',
    ],
    nec: true,
  },
  {
    id: 'production',
    name: 'BMW M2, GR86, MX-5, Clio, FR500S, Solstice, Jetta, Ruf RT 12R, Caterham',
    fullTankSeconds: 60,
    fourTyreSeconds: 40,
    carIds: [
      'bmwm2csr',
      'bmwm2g87',
      'toyotagr86',
      'mx5 mx52016',
      'renaultcliocup',
      'caterham caterham420r',
      'caterham caterhamacademy',
    ],
    nec: true,
  },
  {
    id: 'gte',
    name: 'GTE Class',
    fullTankSeconds: 34,
    fourTyreSeconds: 20,
    carIds: [
      'bmwm8gte',
      'c8rvettegte',
      'ferrari488gte',
      'fordgt2017',
      'porsche991rsr',
    ],
  },
  {
    id: 'lmp1',
    name: 'LMP1 Class',
    fullTankSeconds: 30,
    fourTyreSeconds: 20,
    carIds: ['audir18', 'porsche919'],
  },
  {
    id: 'hpdArx01c',
    name: 'HPD ARX-01C (LMP2)',
    fullTankSeconds: 30,
    fourTyreSeconds: 20,
    carIds: ['hpdarx01c'],
  },
  {
    id: 'gt1',
    name: 'GT1 Class',
    fullTankSeconds: 34,
    fourTyreSeconds: 20,
    carIds: ['astonmartin dbr9', 'c6r'],
  },
  {
    id: 'fordGtGt2',
    name: 'Ford GT (GT2)',
    fullTankSeconds: 34,
    fourTyreSeconds: 20,
    carIds: [],
  },
  {
    id: 'daytonaPrototype',
    name: 'Daytona Prototypes',
    fullTankSeconds: 30,
    fourTyreSeconds: 20,
    carIds: [],
  },
  {
    id: 'nissanGtpAudi90',
    name: 'Nissan GTP & Audi 90 GTO',
    fullTankSeconds: 45,
    fourTyreSeconds: 15,
    carIds: [],
  },
  {
    id: 'radical',
    name: 'Radical SR8 & SR10',
    fullTankSeconds: 40,
    fourTyreSeconds: 20,
    carIds: ['radical sr8', 'radicalsr10'],
  },
  {
    id: 'specRacerFord',
    name: 'Spec Racer Ford',
    fullTankSeconds: 36,
    fourTyreSeconds: 40,
    carIds: ['specracer'],
  },
  {
    id: 'missionR',
    name: 'Porsche Mission R',
    fullTankSeconds: 820,
    fourTyreSeconds: 20,
    carIds: [],
  },
];

export const ruleFamilyFromTag = (
  tag: string | null | undefined
): PitRuleFamily => {
  const value = (tag ?? '').toLowerCase();
  if (value.includes('imsa')) return 'imsa';
  if (value.includes('nec')) return 'nec';
  if (value.includes('dtm')) return 'dtm';
  return 'default';
};

export const ruleSetKey = (tag: string | null | undefined): string => {
  const value = (tag ?? '').trim().toLowerCase();
  return value === '' ? 'default' : value;
};

const ROWS_BY_CAR = new Map<string, TableRow>(
  PIT_TABLE_ROWS.flatMap((row) =>
    row.carIds.map((carId) => [carId, row] as const)
  )
);

export const findTableRow = (carPath: string): TableRow | null =>
  ROWS_BY_CAR.get(carPath) ?? null;

export interface TableRuleResult {
  rule: PitServiceRule;
  rowId: string;
  /** The family whose rules were applied, after unsupported-car fallback. */
  family: PitRuleFamily;
  source: Extract<PitEstimateSource, 'table' | 'tableDefault'>;
}

export const resolveTableRule = (
  carPath: string,
  requested: PitRuleFamily,
  tankLitres: number
): TableRuleResult | null => {
  const row = findTableRow(carPath);
  if (!row || !(tankLitres > 0)) return null;

  const supported =
    requested === 'default' ||
    requested === 'imsa' ||
    (requested === 'nec' && row.nec === true) ||
    (requested === 'dtm' && row.dtm === true);
  const family: PitRuleFamily = supported ? requested : 'default';

  let fullTankSeconds = row.fullTankSeconds;
  let fourTyreSeconds = row.fourTyreSeconds;
  if (family === 'nec') fullTankSeconds = NEC_FULL_TANK_SECONDS;
  if (family === 'dtm') {
    fullTankSeconds = DTM_FULL_TANK_SECONDS;
    fourTyreSeconds = DTM_FOUR_TYRE_SECONDS;
  }

  return {
    rule: {
      fuelLitresPerSecond: tankLitres / fullTankSeconds,
      fourTyreSeconds,
      sequencing: family === 'default' ? 'fuelThenTyres' : 'simultaneous',
      overheadSeconds: DEFAULT_STOP_OVERHEAD_SECONDS,
    },
    rowId: row.id,
    family,
    source: supported ? 'table' : 'tableDefault',
  };
};
