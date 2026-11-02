/**
 * Normalises whatever the rating service calls a nationality into the ISO
 * 3166-1 alpha-2 code the flag renderer wants.
 *
 * The service is not consistent about this -- profiles carry alpha-2 in some
 * records and alpha-3 in others, and LMU's own `/rest/multiplayer/teams`
 * answers with alpha-3 -- so rather than guess at the source, both are
 * accepted and anything unrecognised is dropped. A wrong flag is worse than
 * no flag.
 *
 * Pure and dependency-free so it can be tested without a network or a sim.
 */

/**
 * ISO 3166-1 alpha-3 to alpha-2, for the countries that actually turn up in
 * sim racing. An alpha-3 outside this map yields no flag rather than a guess:
 * the first two letters of an alpha-3 code are frequently a *different*
 * country (DEU is Germany, DE is Germany, but DNK is Denmark and DN is
 * nothing, while ARE is the UAE and AR is Argentina).
 */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  ARE: 'AE',
  ARG: 'AR',
  AUS: 'AU',
  AUT: 'AT',
  BEL: 'BE',
  BGR: 'BG',
  BLR: 'BY',
  BRA: 'BR',
  CAN: 'CA',
  CHE: 'CH',
  CHL: 'CL',
  CHN: 'CN',
  COL: 'CO',
  CRI: 'CR',
  CYP: 'CY',
  CZE: 'CZ',
  DEU: 'DE',
  DNK: 'DK',
  DOM: 'DO',
  ECU: 'EC',
  EGY: 'EG',
  ESP: 'ES',
  EST: 'EE',
  FIN: 'FI',
  FRA: 'FR',
  GBR: 'GB',
  GRC: 'GR',
  GTM: 'GT',
  HKG: 'HK',
  HRV: 'HR',
  HUN: 'HU',
  IDN: 'ID',
  IND: 'IN',
  IRL: 'IE',
  ISL: 'IS',
  ISR: 'IL',
  ITA: 'IT',
  JPN: 'JP',
  KOR: 'KR',
  KWT: 'KW',
  LTU: 'LT',
  LUX: 'LU',
  LVA: 'LV',
  MAC: 'MO',
  MAR: 'MA',
  MCO: 'MC',
  MEX: 'MX',
  MYS: 'MY',
  NLD: 'NL',
  NOR: 'NO',
  NZL: 'NZ',
  PAN: 'PA',
  PER: 'PE',
  PHL: 'PH',
  POL: 'PL',
  PRI: 'PR',
  PRT: 'PT',
  PRY: 'PY',
  QAT: 'QA',
  ROU: 'RO',
  RUS: 'RU',
  SAU: 'SA',
  SGP: 'SG',
  SRB: 'RS',
  SVK: 'SK',
  SVN: 'SI',
  SWE: 'SE',
  THA: 'TH',
  TUR: 'TR',
  TWN: 'TW',
  UKR: 'UA',
  URY: 'UY',
  USA: 'US',
  VEN: 'VE',
  VNM: 'VN',
  ZAF: 'ZA',
};

/**
 * The home nations, which the flag renderer supports as subdivision codes and
 * which drivers from the UK overwhelmingly prefer to GB.
 */
const SUBDIVISIONS: Record<string, string> = {
  ENG: 'GB-ENG',
  SCT: 'GB-SCT',
  WLS: 'GB-WLS',
  NIR: 'GB-NIR',
};

/**
 * Returns an upper-case alpha-2 (or a `GB-XXX` subdivision), or undefined.
 *
 * Accepts alpha-2 as-is without validating it against a list: the alpha-2
 * space is dense, the renderer degrades to no flag on an unknown class, and
 * maintaining a second 250-entry table to catch typos is not worth it.
 */
export function normaliseNationality(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) return undefined;
  if (code.length === 2) return code;
  return SUBDIVISIONS[code] ?? ALPHA3_TO_ALPHA2[code];
}

/**
 * Nationalities from LMU's own `/rest/multiplayer/teams`, keyed by driver
 * name.
 *
 * The sim reports a nationality for every entry in a multiplayer session, so
 * a flag can be shown with no external service involved at all. Keyed by name
 * because that endpoint carries neither a car index nor a Steam ID.
 *
 * Shape: `{ "drivers": { "<name>": { "nationality": "FRA" } } }`
 *
 * Never throws, per the parser contract in `lmu/rest/tasks.ts`: an
 * unrecognised payload yields an empty map and the caller keeps what it had.
 */
export function parseTeamNationalities(payload: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!payload || typeof payload !== 'object') return out;
  const drivers = (payload as Record<string, unknown>).drivers;
  if (!drivers || typeof drivers !== 'object') return out;
  for (const [name, entry] of Object.entries(drivers)) {
    if (!entry || typeof entry !== 'object') continue;
    const code = normaliseNationality(
      (entry as Record<string, unknown>).nationality
    );
    if (code) out.set(name, code);
  }
  return out;
}
