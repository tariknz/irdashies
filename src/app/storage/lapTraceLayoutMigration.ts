import {
  hasLayoutTree,
  lapTraceTreeFromLegacy,
  type LapTraceLegacyLayout,
} from '@irdashies/types';

/** The settings the layout tree replaced. */
const LEGACY_KEYS: readonly string[] = [
  'showLastCorner',
  'lastCornerPosition',
  'brakeCueBars',
  'brakeCueBarSide',
];

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const booleanOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const sideOrUndefined = (value: unknown): (typeof SIDES)[number] | undefined =>
  SIDES.find((side) => side === value);

/**
 * The old settings as stored. A value of the wrong type is left out, so the
 * builder treats it as the old default, like a missing one.
 */
const legacyLayoutOf = (
  config: Record<string, unknown>
): LapTraceLegacyLayout => ({
  showLastCorner: booleanOrUndefined(config.showLastCorner),
  lastCornerPosition: sideOrUndefined(config.lastCornerPosition),
  brakeCueBars: booleanOrUndefined(config.brakeCueBars),
  brakeCueBarSide: sideOrUndefined(config.brakeCueBarSide),
});

/**
 * Before the layout editor, four settings placed the lap trace's last-corner
 * panel and countdown strip: showLastCorner, lastCornerPosition, brakeCueBars
 * and brakeCueBarSide. A layout tree replaced them.
 *
 * A config saved before then has no tree. It gets one built from those
 * settings, so the widget looks as it did, and the settings are dropped. A
 * setting that is missing (an old export, a hand-edited file) counts as what
 * it defaulted to then, which is what that config showed: no panel, no strip.
 *
 * Runs on the stored config, before the defaults are merged in: merged first,
 * the default three-column tree would take the place of the user's layout. A
 * tree that is there but damaged is dropped, and the default fills in (R8.3).
 * A config with a valid tree and none of the old settings comes back as it
 * was, so running this again changes nothing.
 */
export const migrateLapTraceLayout = (config: unknown): unknown => {
  if (!isRecord(config)) return config;
  const hasLegacy = LEGACY_KEYS.some((key) => key in config);
  const treeIsValid = hasLayoutTree(config.layoutTree);
  if (treeIsValid && !hasLegacy) return config;

  const kept = Object.fromEntries(
    Object.entries(config).filter(
      ([key]) => key !== 'layoutTree' && !LEGACY_KEYS.includes(key)
    )
  );
  if (treeIsValid) return { ...kept, layoutTree: config.layoutTree };
  if (config.layoutTree === undefined) {
    return {
      ...kept,
      layoutTree: lapTraceTreeFromLegacy(legacyLayoutOf(config)),
    };
  }
  return kept;
};
