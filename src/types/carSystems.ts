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
   * Set where the scale is known to run negative, so 0 is an ordinary setting
   * rather than "off".
   *
   * The processor also works this out at runtime by watching for a negative
   * value, which is enough for a variable that spends most of its time away
   * from zero. It is not enough for one centred on zero: the neutral setting
   * would be reported as off until the driver happened to cross into negative,
   * and a session that never leaves the middle of the range would never
   * correct itself.
   */
  signed?: boolean;
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
  // Hybrid deployment, on the cars that have it. Only the two dials appear
  // here: the driver sets a deploy level and a regen level and reads them back,
  // which is exactly what this widget is for. The energy those dials govern —
  // EnergyERSBatteryPct and friends — is a live readout that swings the full
  // 0..100% inside a single lap, and belongs in a gauge rather than in a table
  // of dial positions.
  //
  // Levels are fractional 0..1, matching the Hybrid: DeployLevel / RegenLevel
  // pair in session info, so they are shown to one decimal as the setup screen
  // does. Recorded sessions have not yet caught a driver moving either dial, so
  // the step size is unconfirmed; one decimal reads correctly either way.
  {
    key: 'dcMGUKDeployFixed',
    label: 'Deploy Level',
    short: 'DEP',
    precision: 1,
    chip: 'bg-orange-600',
  },
  {
    key: 'dcMGUKRegenGain',
    label: 'Regen Level',
    short: 'REGEN',
    precision: 1,
    chip: 'bg-emerald-600',
  },
  // There is no left weight jacker. The device raises and lowers the right rear
  // ride height, so iRacing publishes dcWeightJackerRight alone — confirmed by
  // L061N on #723 and borne out by the recorded sessions, where the key appears
  // on the IR18 and dcWeightJackerLeft appears on nothing. A row for it could
  // only ever sit blank, so it is not offered.
  {
    key: 'dcWeightJackerRight',
    label: 'Weight Jacker',
    short: 'JACK',
    precision: 0,
    // Runs roughly -20..20, and 0 is the middle of that range rather than the
    // bottom of it. Declared rather than inferred: the processor otherwise
    // learns a scale is signed only once it sees a negative, so a jacker sat at
    // its neutral setting would read as switched off until the driver first
    // wound it the other way — and on a road course, where the setup locks it
    // to 0 for the whole session, it never would.
    signed: true,
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

/**
 * A car-specific name for an adjustment, replacing the catalogue's generic one.
 *
 * iRacing does not publish a channel per physical control. It publishes a fixed
 * set of `dc*` variables and each car wires its own dials to whichever ones fit,
 * so the same channel can carry a different control from one car to the next —
 * the same reason `dcPeakBrakeBias` already has to share the brake bias column.
 *
 * Only the display strings are overridden. The telemetry key stays the identity
 * of the row: it is what `CarSystemsConfig.rows` persists and what
 * `DEFAULT_CAR_SYSTEM_ROWS` lists, so a driver who enabled a row keeps it when
 * they switch cars, and it is simply named differently.
 */
export interface CarSystemLabelOverride {
  label: string;
  short: string;
}

/**
 * Car paths are matched case-insensitively and ignoring punctuation, matching
 * how `carData.ts` resolves the bundled tachometer data. `CarPath` is stable
 * for a given car but its exact spelling is not worth depending on.
 */
export const normalizeCarPath = (carPath: string): string =>
  carPath.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Per-car renames, keyed by normalized `DriverInfo.Drivers[].CarPath`, then by
 * telemetry key.
 *
 * Deliberately sparse. A car absent from this table gets the catalogue label,
 * which is the right answer for the overwhelming majority — so a new iRacing
 * car is named sensibly on release rather than blank, and only genuine
 * deviations need an entry.
 *
 * A wrong rename here is worse than a generic name, because the driver has no
 * way to tell it is wrong. So an entry needs either a capture showing the
 * channel move when that dial moved, or a named source plus a note saying it is
 * provisional and what would confirm it. Nothing goes in on inference from a
 * car's spec sheet alone.
 */
export const CAR_SYSTEM_LABEL_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, CarSystemLabelOverride>>>
> = {
  // PROVISIONAL - not yet confirmed against a recorded session.
  //
  // Reported by L061N on #723, from a telemetry viewer and an LMP2 session
  // file: on this car the dial published as dcABS is brake migration, not ABS.
  // That is plausible on its face - the Oreca-era LMP2 has no ABS to adjust,
  // while brake migration is a control it does have - but it rests on someone
  // else's screenshot rather than on a capture, so it is flagged rather than
  // quietly trusted. Confirm by sweeping the migration dial in the P217 and
  // checking that dcABS is what moves.
  dallarap217: {
    dcABS: { label: 'Brake Migration', short: 'MIGR' },
  },
};

/** The catalogue entry for a key, renamed if the current car renames it. */
export const resolveCarSystemDefinition = (
  definition: CarSystemDefinition,
  carPath: string | undefined
): CarSystemDefinition => {
  if (!carPath) return definition;
  const override =
    CAR_SYSTEM_LABEL_OVERRIDES[normalizeCarPath(carPath)]?.[definition.key];
  return override ? { ...definition, ...override } : definition;
};

/**
 * Cars that rename a given adjustment, for settings to mention. Settings is a
 * global screen rather than a per-car one, so it keeps the catalogue name and
 * uses this only to warn that the name varies.
 */
export const carSystemIsRenamedSomewhere = (key: string): boolean =>
  Object.values(CAR_SYSTEM_LABEL_OVERRIDES).some((car) => key in car);
