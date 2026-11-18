import type {
  PitServiceProfile,
  PitStopRecord,
  PitTyreChange,
} from '@irdashies/types';

/** Measured stall time runs a little over the crew's service time. */
const TOLERANCE_SECONDS = 2;
/** Litres either side of the expected fill that still count as a match. */
const CONFIDENT_LITRES = 5;
const TYRE_CHANGES: PitTyreChange[] = ['front', 'rear', 'left', 'right', 'all'];

const TYRE_LABELS: Record<PitTyreChange, string> = {
  front: 'front tyres',
  rear: 'rear tyres',
  left: 'left tyres',
  right: 'right tyres',
  all: '4 tyres',
};

export type PitServiceKind =
  | 'service'
  | 'drive-through'
  | 'no-service'
  | 'driver-change'
  | 'tow'
  | 'unknown';

export interface PitServiceOption {
  /** Null for no tyres. */
  tyres: PitTyreChange | null;
  /** Litres added. */
  fuel: number;
  label: string;
}

export interface PitServiceEstimate {
  kind: PitServiceKind;
  label: string;
  /** The service read from the stop; null when there is no estimate. */
  best: PitServiceOption | null;
  /** Other services that fit the same stall time. */
  alternatives: PitServiceOption[];
  confident: boolean;
}

export interface PitServiceInput {
  stop: Pick<PitStopRecord, 'kind' | 'stallTime' | 'fastRepairs'>;
  /** Stall time including any visit still in progress. */
  stallSeconds: number;
  driverChanged: boolean;
  /** Laps since the car's previous stop; 0 when not known. */
  stintLaps: number;
  profile: PitServiceProfile | undefined;
}

const describe = (tyres: PitTyreChange | null, fuel: number): string => {
  const litres = Math.round(fuel);
  if (tyres === null) return litres > 0 ? `Fuel ${litres} L` : 'No service';
  const tyreLabel = TYRE_LABELS[tyres];
  return litres > 0
    ? `Fuel ${litres} L + ${tyreLabel}`
    : `${tyreLabel[0].toUpperCase()}${tyreLabel.slice(1)} only`;
};

const only = (kind: PitServiceKind, label: string): PitServiceEstimate => ({
  kind,
  label,
  best: null,
  alternatives: [],
  confident: true,
});

/**
 * Services that take as long as the stall time: fuel and tyres are done one
 * after the other, so each tyre change leaves the rest of the stop for fuel.
 */
export const pitServiceOptions = (
  serviceSeconds: number,
  profile: PitServiceProfile
): PitServiceOption[] => {
  const options: PitServiceOption[] = [];
  const tank = profile.tankLitres > 0 ? profile.tankLitres : Infinity;
  const tryOption = (tyres: PitTyreChange | null, tyreSeconds: number) => {
    const fuelSeconds = serviceSeconds - tyreSeconds;
    if (fuelSeconds < -TOLERANCE_SECONDS) return;
    // Within the tolerance of the tyre time alone: no fuel was added.
    const fuel =
      fuelSeconds <= TOLERANCE_SECONDS ? 0 : fuelSeconds * profile.fuelRate;
    if (fuel > tank + CONFIDENT_LITRES) return;
    options.push({ tyres, fuel, label: describe(tyres, fuel) });
  };
  tryOption(null, 0);
  for (const tyres of TYRE_CHANGES) {
    const seconds = profile.tyres[tyres];
    if (seconds > 0) tryOption(tyres, seconds);
  }
  return options;
};

/** Reads what a stop most likely included from its stall time. */
export const estimatePitService = ({
  stop,
  stallSeconds,
  driverChanged,
  stintLaps,
  profile,
}: PitServiceInput): PitServiceEstimate => {
  if (stop.kind === 'tow') return only('tow', 'Towed to the pits');
  if (stop.stallTime === null) return only('drive-through', 'Drive-through');
  if (stallSeconds < 3 && !driverChanged)
    return only('no-service', 'Stop, no service');
  if (!profile) {
    return {
      ...only('unknown', driverChanged ? 'Driver change' : 'Service'),
      confident: false,
    };
  }

  // A swap runs alongside the service, so a stop no longer than the swap
  // hides whatever service it included.
  if (
    driverChanged &&
    stallSeconds <= profile.driverChangeSeconds + TOLERANCE_SECONDS
  ) {
    return {
      kind: 'driver-change',
      label: 'Driver change',
      best: null,
      alternatives: [],
      confident: false,
    };
  }

  const options = pitServiceOptions(stallSeconds, profile);
  if (options.length === 0) {
    return { ...only('unknown', 'Repairs or a long stop'), confident: false };
  }

  const expected =
    profile.fuelPerLap > 0 && stintLaps > 0
      ? Math.min(
          stintLaps * profile.fuelPerLap,
          profile.tankLitres > 0 ? profile.tankLitres : Infinity
        )
      : null;
  const ranked =
    expected === null
      ? options
      : [...options].sort(
          (a, b) => Math.abs(a.fuel - expected) - Math.abs(b.fuel - expected)
        );
  const [best, ...alternatives] = ranked;
  const confident =
    expected !== null &&
    stop.fastRepairs === 0 &&
    Math.abs(best.fuel - expected) <= CONFIDENT_LITRES &&
    (alternatives.length === 0 ||
      Math.abs(alternatives[0].fuel - expected) -
        Math.abs(best.fuel - expected) >=
        CONFIDENT_LITRES);

  const label = driverChanged ? `Driver change, ${best.label}` : best.label;
  return {
    kind: 'service',
    label: stop.fastRepairs > 0 ? `Fast repair, ${label}` : label,
    best,
    alternatives,
    confident,
  };
};
