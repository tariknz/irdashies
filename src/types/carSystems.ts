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
  /** Telemetry variable name, e.g. 'dcABS'. Stable identity for the row. */
  key: string;
  /** Display label. */
  label: string;
  /** Decimal places the value is meaningful to. */
  precision: number;
  /** Appended on display. */
  unit?: string;
}

export const CAR_SYSTEM_ADJUSTMENTS: readonly CarSystemDefinition[] = [
  { key: 'dcBrakeBias', label: 'Brake Bias', precision: 1, unit: '%' },
  // The Renault Clio reports its bias here instead. The two never coexist, so
  // they share a row and whichever the car publishes fills it.
  { key: 'dcPeakBrakeBias', label: 'Brake Bias', precision: 1, unit: '%' },
  { key: 'dcABS', label: 'ABS', precision: 0 },
  { key: 'dcTractionControl', label: 'TC', precision: 0 },
  { key: 'dcTractionControl2', label: 'TC2', precision: 0 },
  { key: 'dcThrottleShape', label: 'Throttle Shape', precision: 0 },
  { key: 'dcEnginePower', label: 'Engine Power', precision: 0 },
  { key: 'dcFuelMixture', label: 'Fuel Mixture', precision: 0 },
  { key: 'dcAntiRollFront', label: 'ARB Front', precision: 0 },
  { key: 'dcAntiRollRear', label: 'ARB Rear', precision: 0 },
  { key: 'dcDiffEntry', label: 'Diff Entry', precision: 0 },
  { key: 'dcDiffMiddle', label: 'Diff Mid', precision: 0 },
  { key: 'dcDiffExit', label: 'Diff Exit', precision: 0 },
  { key: 'dcWeightJackerLeft', label: 'Jacker L', precision: 0 },
  { key: 'dcWeightJackerRight', label: 'Jacker R', precision: 0 },
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
