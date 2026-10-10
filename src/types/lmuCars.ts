/**
 * Le Mans Ultimate's cars, by manufacturer.
 *
 * LMU's shared memory names a vehicle model but carries no car id, so the
 * mapper synthesises one per manufacturer. Those ids then have to mean
 * something to the renderer's manufacturer lookup, which is keyed on id.
 *
 * Both halves live here because they are one fact. The ids were defined in the
 * main-process mapper and the lookup in the frontend, with nothing tying them
 * together, so the renderer knew none of them: no manufacturer badge appeared
 * in the standings, and the manufacturer-position item returned null before it
 * rendered anything, because it resolves the player's manufacturer from the
 * same table.
 *
 * Order matters. A chassis maker has to precede any engine-supplier brand that
 * could also appear in the model string, so a "Ligier JS P320 Nissan" resolves
 * to the chassis rather than the engine badge.
 */
export interface LmuManufacturer {
  /** Synthesised car id. Stable: it reaches saved settings and layouts. */
  id: number;
  /** Matched against the vehicle model string from shared memory. */
  pattern: RegExp;
  /** Sprite key in CAR_MANUFACTURER_SPRITE_POSITIONS. */
  manufacturer: string;
  /** Display name, used where the iRacing table would name a model. */
  name: string;
}

export const LMU_MANUFACTURERS: readonly LmuManufacturer[] = [
  {
    id: 10001,
    pattern: /\baston martin\b/i,
    manufacturer: 'astonmartin',
    name: 'Aston Martin',
  },
  { id: 10002, pattern: /\baudi\b/i, manufacturer: 'audi', name: 'Audi' },
  { id: 10003, pattern: /\bbmw\b/i, manufacturer: 'bmw', name: 'BMW' },
  {
    id: 10004,
    pattern: /\bcadillac\b/i,
    manufacturer: 'cadillac',
    name: 'Cadillac',
  },
  {
    id: 10005,
    pattern: /\b(?:chevrolet|corvette)\b/i,
    manufacturer: 'chevrolet',
    name: 'Chevrolet',
  },
  {
    id: 10006,
    pattern: /\bferrari\b/i,
    manufacturer: 'ferrari',
    name: 'Ferrari',
  },
  { id: 10007, pattern: /\bford\b/i, manufacturer: 'ford', name: 'Ford' },
  {
    id: 10008,
    pattern: /\blamborghini\b/i,
    manufacturer: 'lamborghini',
    name: 'Lamborghini',
  },
  // LMP3 chassis maker. Must precede engine-supplier brands so a
  // "Ligier JS P320 Nissan" style model never resolves to the engine badge.
  { id: 10013, pattern: /\bligier\b/i, manufacturer: 'ligier', name: 'Ligier' },
  {
    id: 10009,
    pattern: /\bmclaren\b/i,
    manufacturer: 'mclaren',
    name: 'McLaren',
  },
  {
    id: 10010,
    pattern: /\bmercedes(?:-amg)?\b/i,
    manufacturer: 'mercedes',
    name: 'Mercedes-AMG',
  },
  {
    id: 10011,
    pattern: /\bporsche\b/i,
    manufacturer: 'porsche',
    name: 'Porsche',
  },
  { id: 10012, pattern: /\btoyota\b/i, manufacturer: 'toyota', name: 'Toyota' },
];

/** The renderer's view of the same table: id to badge and display name. */
export const LMU_CAR_ID_TO_MANUFACTURER: Readonly<
  Record<number, { name: string; manufacturer: string }>
> = Object.fromEntries(
  LMU_MANUFACTURERS.map(({ id, name, manufacturer }) => [
    id,
    { name, manufacturer },
  ])
);
