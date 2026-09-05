/**
 * The driver-adjustable systems the overlay knows how to display.
 *
 * Shared rather than owned by the processor because the widget renders a fixed
 * set of rows and blanks the ones the current car does not have — so it needs
 * the labels for adjustments that are absent from the snapshot.
 *
 * Only settings belong here: things a driver turns a dial to change and then
 * wants to read back. Momentary controls are deliberately excluded — dcStarter,
 * dcHeadlightFlash, dcTearOffVisor, the wiper controls, dcDashPage and
 * dcPitSpeedLimiterToggle are button presses rather than state. So is
 * dcTractionControlToggle, despite the name: recorded sessions show it reading
 * false continuously while traction control is set to 1..5, so treating it as
 * an on/off state would misreport every car that has it.
 */
export interface CarSystemDefinition {
  /** Telemetry variable name, e.g. 'dcABS'. Stable identity for the column. */
  key: string;
  /** Full label, used in settings. */
  label: string;
  /** Abbreviation for the column header, where space is tight. */
  short: string;
  /** Decimal places the value is meaningful to. */
  precision: number;
  /** Appended on display. */
  unit?: string;
  /**
   * Tailwind background class for the column header chip, in the Pitlane
   * Helper's idiom: a solid colour behind small bold caps.
   *
   * Colours carry meaning where the app already has one. Amber is fuel because
   * FuelCalculator is amber throughout. Yellow is deliberately unused: it means
   * caution and off-track elsewhere (Flag, Battle), and a fuel column that
   * looked like a warning would be actively misleading. Red is braking, which
   * is why brake bias takes it.
   */
  chip: string;
}

export const CAR_SYSTEM_ADJUSTMENTS: readonly CarSystemDefinition[] = [
  {
    key: 'dcBrakeBias',
    label: 'Brake Bias',
    short: 'BB',
    precision: 1,
    unit: '%',
    chip: 'bg-red-600',
  },
  // The Renault Clio reports its bias here instead. The two never coexist, so
  // they share a column and whichever the car publishes fills it.
  {
    key: 'dcPeakBrakeBias',
    label: 'Brake Bias',
    short: 'BB',
    precision: 1,
    unit: '%',
    chip: 'bg-red-600',
  },
  {
    key: 'dcABS',
    label: 'ABS',
    short: 'ABS',
    precision: 0,
    chip: 'bg-green-600',
  },
  {
    key: 'dcTractionControl',
    label: 'Traction Control',
    short: 'TC',
    precision: 0,
    chip: 'bg-blue-700',
  },
  {
    key: 'dcTractionControl2',
    label: 'Traction Control 2',
    short: 'TC2',
    precision: 0,
    chip: 'bg-sky-600',
  },
  {
    key: 'dcThrottleShape',
    label: 'Throttle Shape',
    short: 'THR',
    precision: 0,
    chip: 'bg-purple-600',
  },
  {
    key: 'dcEnginePower',
    label: 'Engine Power',
    short: 'PWR',
    precision: 0,
    chip: 'bg-violet-700',
  },
  {
    key: 'dcFuelMixture',
    label: 'Fuel Mixture',
    short: 'FUEL',
    precision: 0,
    chip: 'bg-amber-600',
  },
  {
    key: 'dcAntiRollFront',
    label: 'ARB Front',
    short: 'ARBF',
    precision: 0,
    chip: 'bg-teal-600',
  },
  {
    key: 'dcAntiRollRear',
    label: 'ARB Rear',
    short: 'ARBR',
    precision: 0,
    chip: 'bg-teal-700',
  },
  {
    key: 'dcDiffEntry',
    label: 'Diff Entry',
    short: 'DIFE',
    precision: 0,
    chip: 'bg-indigo-600',
  },
  {
    key: 'dcDiffMiddle',
    label: 'Diff Mid',
    short: 'DIFM',
    precision: 0,
    chip: 'bg-indigo-700',
  },
  {
    key: 'dcDiffExit',
    label: 'Diff Exit',
    short: 'DIFX',
    precision: 0,
    chip: 'bg-indigo-800',
  },
  {
    key: 'dcWeightJackerLeft',
    label: 'Jacker L',
    short: 'JKL',
    precision: 0,
    chip: 'bg-stone-600',
  },
  {
    key: 'dcWeightJackerRight',
    label: 'Jacker R',
    short: 'JKR',
    precision: 0,
    chip: 'bg-stone-700',
  },
];

/**
 * Rows shown by default: the adjustments most cars with any assists expose.
 * Everything else is available in settings but off, so a GT3 driver is not
 * given a column of empty differential rows.
 *
 * `dcPeakBrakeBias` is not listed because it shares the brake bias row.
 */
export const DEFAULT_CAR_SYSTEM_ROWS: readonly string[] = [
  'dcBrakeBias',
  'dcABS',
  'dcTractionControl',
  'dcTractionControl2',
  'dcThrottleShape',
];

/** The row a telemetry key is displayed in; brake bias has two sources. */
export const carSystemRowKey = (key: string): string =>
  key === 'dcPeakBrakeBias' ? 'dcBrakeBias' : key;
