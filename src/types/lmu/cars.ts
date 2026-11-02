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
/**
 * Every synthesised LMU car id is at or above this.
 *
 * iRacing's own ids are real and far below it, so the boundary is what tells
 * the renderer which manufacturer sheet a car belongs to -- no extra prop has
 * to be threaded down to the row to say which simulator is running.
 */
export const LMU_CAR_ID_BASE = 10000;

export interface LmuManufacturer {
  /** Synthesised car id. Stable: it reaches saved settings and layouts. */
  id: number;
  /** Matched against the vehicle model string from shared memory. */
  pattern: RegExp;
  /**
   * Sprite key in LMU_MANUFACTURER_SPRITE_POSITIONS -- LMU's own sheet, not
   * the iRacing one. The two share only some marques, so they are separate
   * images and either can be regenerated without the other.
   */
  manufacturer: string;
  /** Display name, used where the iRacing table would name a model. */
  name: string;
}

export const LMU_MANUFACTURERS: readonly LmuManufacturer[] = [
  // Ids 10001-10013 predate LMU's own sprite sheet and are kept exactly as
  // they were: they reach saved settings and layouts, so renumbering one
  // would silently change which badge an existing dashboard shows.
  {
    id: 10001,
    pattern: /\baston martin\b/i,
    manufacturer: 'astonmartin',
    name: 'Aston Martin',
  },
  { id: 10003, pattern: /\bbmw\b/i, manufacturer: 'bmw', name: 'BMW' },
  {
    id: 10004,
    pattern: /\bcadillac\b/i,
    manufacturer: 'cadillac',
    name: 'Cadillac',
  },
  {
    // `corvette`, not `chevrolet`: LMU's sheet carries the Corvette mark, and
    // the car it runs is a Corvette. The slug is a key into the LMU sheet
    // rather than the iRacing one, so it names what that sheet holds.
    id: 10005,
    pattern: /\b(?:chevrolet|corvette)\b/i,
    manufacturer: 'corvette',
    name: 'Corvette',
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
  {
    id: 10009,
    pattern: /\bmclaren\b/i,
    manufacturer: 'mclaren',
    name: 'McLaren',
  },
  {
    id: 10010,
    pattern: /\bmercedes(?:-amg)?\b/i,
    manufacturer: 'mercedesamg',
    name: 'Mercedes-AMG',
  },
  {
    id: 10011,
    pattern: /\bporsche\b/i,
    manufacturer: 'porsche',
    name: 'Porsche',
  },
  { id: 10012, pattern: /\btoyota\b/i, manufacturer: 'toyota', name: 'Toyota' },
  { id: 10013, pattern: /\bligier\b/i, manufacturer: 'ligier', name: 'Ligier' },

  // The marques iRacing has no equivalent for, which is why LMU needs a sheet
  // of its own rather than a few more cells in the shared one.
  { id: 10014, pattern: /\badess\b/i, manufacturer: 'adess', name: 'Adess' },
  { id: 10015, pattern: /\balpine\b/i, manufacturer: 'alpine', name: 'Alpine' },
  {
    id: 10016,
    pattern: /\bduqueine\b/i,
    manufacturer: 'duqueine',
    name: 'Duqueine',
  },
  {
    id: 10017,
    pattern: /\bgenesis\b/i,
    manufacturer: 'genesis',
    name: 'Genesis',
  },
  {
    id: 10018,
    pattern: /\bginetta\b/i,
    manufacturer: 'ginetta',
    name: 'Ginetta',
  },
  {
    id: 10019,
    pattern: /\bglickenhaus\b/i,
    manufacturer: 'glickenhaus',
    name: 'Glickenhaus',
  },
  {
    id: 10020,
    pattern: /\bisotta(?:\s+fraschini)?\b/i,
    manufacturer: 'isottafraschini',
    name: 'Isotta Fraschini',
  },
  { id: 10021, pattern: /\blexus\b/i, manufacturer: 'lexus', name: 'Lexus' },
  {
    // Before any engine brand, like the Ligier note above: an "Oreca 07
    // Gibson" is an Oreca chassis.
    id: 10022,
    pattern: /\boreca\b/i,
    manufacturer: 'oreca',
    name: 'Oreca',
  },
  {
    id: 10023,
    pattern: /\bpeugeot\b/i,
    manufacturer: 'peugeot',
    name: 'Peugeot',
  },
  {
    // The developer's own car, which appears in test and bonus content.
    id: 10024,
    pattern: /\bstudio\s*397\b/i,
    manufacturer: 'studio397',
    name: 'Studio 397',
  },
  {
    id: 10025,
    pattern: /\bvanwall\b/i,
    manufacturer: 'vanwall',
    name: 'Vanwall',
  },
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
