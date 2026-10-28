import { LMU_MANUFACTURERS } from '@irdashies/types';

/**
 * Optimal upshift RPM for LMU's cars, where one is known.
 *
 * LMU's shared memory carries the engine's rev limit but no shift point, so
 * without this the shift light can only guess at a fixed fraction of that
 * limit. These are per-car figures for the classes that have them: one value
 * per GT3 make, and one for every LMP2, whose engine is common to the field.
 * LMP3, Hypercar and GTE have none, and keep the guess.
 */
const GT3_SHIFT_RPM: Readonly<Record<string, number>> = {
  astonmartin: 6950,
  lamborghini: 8200,
  mercedesamg: 7000,
  porsche: 8800,
  mclaren: 7600,
  lexus: 6950,
  ford: 7950,
  ferrari: 7300,
  bmw: 6950,
  corvette: 7600,
};

const LMP2_SHIFT_RPM = 8240;

/**
 * The shift point for a car, or undefined when there is no figure for it.
 *
 * `lmuClass` is the canonical class (see lmuCanonicalClass in mapSession.ts),
 * so LMP2_ELMS arrives here as LMP2. The make is read off the vehicle model
 * the same way the car id is, which is what keeps it independent of the
 * livery: GTE shares makes with GT3, and is why the class is checked first.
 */
export const lmuShiftPointRpm = (
  lmuClass: string | undefined,
  vehicleModel: string | undefined
): number | undefined => {
  if (lmuClass === 'LMP2') return LMP2_SHIFT_RPM;
  if (lmuClass !== 'LMGT3' || !vehicleModel) return undefined;
  const make = LMU_MANUFACTURERS.find(({ pattern }) =>
    pattern.test(vehicleModel)
  )?.manufacturer;
  return make ? GT3_SHIFT_RPM[make] : undefined;
};
