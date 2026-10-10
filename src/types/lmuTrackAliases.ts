/**
 * Le Mans Ultimate's track names, against ids in the *iRacing* dataset.
 *
 * A fallback, not the main route. Lovely publishes a dataset for LMU as well,
 * keyed by LMU's own names lowercased, and loadLmuTrackData reads it directly
 * -- so the 21 layouts it covers need nothing from this table.
 *
 * This is for the layouts LMU runs that its dataset has not reached yet:
 * Laguna Seca, Silverstone's WEC configuration, Barcelona, Daytona's road
 * course and Road Atlanta all exist on the iRacing side, under names no amount
 * of normalising would reach from LMU's -- nothing turns "Circuit de la
 * Sarthe" into "lemans full". The entries that the LMU dataset also covers are
 * kept rather than pruned, because they cost nothing (the LMU lookup is tried
 * first) and because the map generator reads this same table.
 *
 * The same table feeds tools/generate-lmu-track-maps.ts, which borrows these
 * names for the turn labels on its track maps. It lives here so the two cannot
 * disagree about which circuit is which.
 *
 * A layout in neither place -- Long Beach, as of writing -- shows no corner
 * names. That is the honest answer, and the near-miss matching that used to
 * fill the gap answered "Michelin Raceway Road Atlanta" with Daytona.
 */
export const LMU_TRACK_DATA_IDS: Readonly<Record<string, string>> = {
  'Algarve International Circuit': 'algarve gp',
  'Autodromo Enzo e Dino Ferrari': 'imola gp',
  'Autodromo Nazionale Monza': 'monza full',
  'Autódromo José Carlos Pace': 'interlagos gp',
  'Circuit de Barcelona': 'barcelona gp',
  'Circuit de la Sarthe': 'lemans full',
  'Circuit de la Sarthe Mulsanne': 'lemans nochicane',
  'Circuit de Spa-Francorchamps': 'spa 2024 combined',
  'Circuit of the Americas': 'cota-gp',
  'Daytona International Speedway Road Course': 'daytona 2011 road',
  'Michelin Raceway Road Atlanta': 'roadatlanta full',
  'Sebring International Raceway': 'sebring international',
  'Silverstone Grand Prix Circuit - WEC': 'silverstone 2019 gp',
  'WeatherTech Raceway Laguna Seca': 'lagunaseca',
};

/**
 * The dataset id for a track name, or undefined when there is no entry.
 *
 * Matched on the name as published, then case-insensitively, because the
 * accented names are the ones most likely to be transcribed differently by a
 * future build of the sim. No fuzzy matching: a wrong circuit's corner names
 * are worse than none, which is the whole reason this table exists.
 */
export const lmuTrackDataId = (
  trackName: string | undefined
): string | undefined => {
  if (!trackName) return undefined;
  const direct = LMU_TRACK_DATA_IDS[trackName];
  if (direct) return direct;

  const wanted = trackName.trim().toLowerCase();
  for (const [name, id] of Object.entries(LMU_TRACK_DATA_IDS)) {
    if (name.toLowerCase() === wanted) return id;
  }
  return undefined;
};
