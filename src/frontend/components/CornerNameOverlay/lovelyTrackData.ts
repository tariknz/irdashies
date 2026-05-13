/**
 * Pure mapping layer: raw Lovely Sim Racing track JSON →
 * LovelyTrackSection[] + LovelyTrackInfo.
 *
 * The upstream schema (https://github.com/Lovely-Sim-Racing/lovely-track-data):
 *   { name, trackId, country, length, pitentry, pitexit,
 *     turn[]:    { name, start, end, marker? }
 *     straight?[]: { name, start, end, marker }
 *     sector[]:  { name, marker }
 *     time?[],   year? }
 *
 * Notes:
 *  - There is NO `scale` field in real Lovely data — corner severity is
 *    inferred from the section name via regex (`SECTION_TYPE_RULES`).
 *  - Straights are merged into the sections list with type='straight' so the
 *    overlay can render a label on long pieces of track too.
 */

import type {
  LovelyTrackInfo,
  LovelyTrackSection,
  SectionType,
  TrackMarker,
} from '@irdashies/types';
import type {
  LovelySector,
  LovelyStraight,
  LovelyTrack,
  LovelyTurn,
} from '@irdashies/utils/trackData';

// Re-export so existing imports of LovelyRawTrack still resolve until callers migrate.
export type LovelyRawTrack = LovelyTrack;

const SECTION_TYPE_RULES: [RegExp, SectionType][] = [
  [/chicane|schikane|bus\s*stop/i, 'chicane'],
  [/hairpin|kehre|epingle/i, 'hairpin'],
  [/ess(es)?|complex|double\s*gauche/i, 'complex'],
  [/sweeper|kemmel|raidillon|carousel|karussell/i, 'sweeper'],
  [/kink|flugplatz|antoniusbuche|tiergarten/i, 'kink'],
  [/straight|gerade|reta|ligne\s*droite|rettilineo/i, 'straight'],
  [/curve|curva|bend|corner|turn|kurve|virage|courbe/i, 'corner'],
];

const CORNER_NUM_RE = /^Turn\s+(\d+)$/i;

export const slugify = (name: string): string => {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unnamed'
  );
};

const inferType = (name: string): SectionType => {
  for (const [re, type] of SECTION_TYPE_RULES) {
    if (re.test(name)) return type;
  }
  return 'corner';
};

/**
 * Lap-distance is a circular [0,1) space — most sections don't wrap, but a
 * section spanning the start/finish line will have end < start. This returns
 * the on-lap arc length either way.
 */
const wrapAwareLength = (start: number, end: number): number => {
  return end >= start ? end - start : 1 - start + end;
};

/**
 * Map a Lovely turn to a section. Returns null for marker-only turns
 * (some Daytona configs ship turns with no start/end range, only a marker)
 * because the overlay needs a range to render against LapDistPct.
 */
const mapTurn = (
  raw: LovelyTurn,
  unnamedIdx: { count: number }
): LovelyTrackSection | null => {
  if (raw.start === undefined || raw.end === undefined) return null;
  let name = raw.name;
  if (!name) {
    unnamedIdx.count += 1;
    name = `Turn ${unnamedIdx.count}`;
  }
  const cornerMatch = CORNER_NUM_RE.exec(name.trim());
  return {
    section_id: slugify(name),
    name,
    type: inferType(name),
    start_pct: raw.start,
    end_pct: raw.end,
    length_pct: wrapAwareLength(raw.start, raw.end),
    marker_pct: raw.marker,
    corner_number: cornerMatch ? `T${cornerMatch[1]}` : undefined,
  };
};

const mapStraight = (raw: LovelyStraight): LovelyTrackSection | null => {
  if (raw.start === undefined || raw.end === undefined) return null;
  const name = raw.name ?? 'Straight';
  return {
    section_id: slugify(name),
    name,
    type: 'straight',
    start_pct: raw.start,
    end_pct: raw.end,
    length_pct: wrapAwareLength(raw.start, raw.end),
    marker_pct: raw.marker,
  };
};

const mapSector = (raw: LovelySector): TrackMarker => ({
  name: raw.name,
  marker_pct: raw.marker,
});

/**
 * Map raw Lovely JSON → sections (sorted by start_pct) + track info.
 * Pure function; safe to call repeatedly.
 */
export const mapLovelyToTrackData = (
  raw: LovelyRawTrack
): { sections: LovelyTrackSection[]; info: LovelyTrackInfo } => {
  const unnamedIdx = { count: 0 };

  const turns = (raw.turn ?? [])
    .map((t) => mapTurn(t, unnamedIdx))
    .filter((s): s is LovelyTrackSection => s !== null);
  const straights = (raw.straight ?? [])
    .map(mapStraight)
    .filter((s): s is LovelyTrackSection => s !== null);

  // Merge for the overlay; keep straights separately on info too so consumers
  // can filter if they want corners-only.
  const sections = [...turns, ...straights].sort(
    (a, b) => a.start_pct - b.start_pct
  );

  const info: LovelyTrackInfo = {
    track_id: raw.trackId,
    name: raw.name,
    country: raw.country,
    year: raw.year,
    length_m: raw.length,
    pit_entry_pct: raw.pitentry,
    pit_exit_pct: raw.pitexit,
    sectors: (raw.sector ?? []).map(mapSector),
    straights,
    reference_times: raw.time,
  };

  return { sections, info };
};
