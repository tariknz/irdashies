export interface CarSize {
  /** Metres. */
  length: number;
  width: number;
}

/**
 * Typical body sizes, matched on the class or car name. iRacing reports no
 * car dimensions, so these are rounded real-world figures: close enough to
 * judge overlap on a radar, not exact for any one car. First match wins, so
 * narrower patterns come first.
 */
const TYPICAL_SIZES: readonly [RegExp, CarSize][] = [
  [/911 gt3 cup|992 cup|porsche cup/i, { length: 4.6, width: 2.0 }],
  [/truck/i, { length: 5.6, width: 2.0 }],
  [
    /nascar|cup series|next ?gen|xfinity|arca|late model/i,
    { length: 5.2, width: 2.0 },
  ],
  [/supercar/i, { length: 4.9, width: 1.95 }],
  [/gtp|lmdh|hypercar|lmh|lmp1|dpi/i, { length: 5.1, width: 2.0 }],
  [/lmp2/i, { length: 4.75, width: 1.9 }],
  [/lmp3/i, { length: 4.6, width: 1.9 }],
  [
    /indy|ir-?18|ir-?01|super formula|\bsf23\b|\bf1\b|\bw1[23]\b|\bmp4/i,
    { length: 5.2, width: 1.95 },
  ],
  [/\bf4\b|formula vee|skip barber|\bray\b/i, { length: 4.3, width: 1.75 }],
  [
    /\bf3\b|fr ?2\.0|formula|dallara|pro mazda|usf|super ?lights/i,
    { length: 4.9, width: 1.85 },
  ],
  [
    /mx-?5|miata|spec racer|toyota gr86|gr86|brz/i,
    { length: 4.0, width: 1.75 },
  ],
  [/tcr|touring|civic|elantra|golf|audi rs 3/i, { length: 4.4, width: 1.95 }],
  [/gt4/i, { length: 4.5, width: 1.95 }],
  [/gt3|gte|gtd|gtlm/i, { length: 4.6, width: 2.0 }],
];

/** The typical size for a class or car name, if one is known. */
export const typicalCarSize = (
  ...names: readonly (string | undefined)[]
): CarSize | null => {
  for (const name of names) {
    if (!name) continue;
    for (const [pattern, size] of TYPICAL_SIZES) {
      if (pattern.test(name)) return size;
    }
  }
  return null;
};

/** Saved settings are untrusted; only a sane size is used. */
const isValidSize = (size: CarSize | undefined): size is CarSize =>
  !!size &&
  Number.isFinite(size.length) &&
  Number.isFinite(size.width) &&
  size.length > 1 &&
  size.length < 10 &&
  size.width > 0.5 &&
  size.width < 4;

export interface CarSizeOptions {
  sizeByClass: boolean;
  /** Per-class overrides keyed by class short name. */
  classSizes: Readonly<Record<string, CarSize>>;
  /** Used when nothing more specific is known. */
  fallback: CarSize;
}

/**
 * Size to draw a car at: a saved override for its class, then the typical
 * size for its class or model, then the default from settings.
 */
export const resolveCarSize = (
  className: string | undefined,
  carName: string | undefined,
  { sizeByClass, classSizes, fallback }: CarSizeOptions
): CarSize => {
  if (!sizeByClass) return fallback;
  const override = className ? classSizes[className] : undefined;
  if (isValidSize(override)) return override;
  return typicalCarSize(className, carName) ?? fallback;
};
