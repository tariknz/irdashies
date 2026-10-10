import {
  SIMULATOR_IDS,
  SIMULATOR_LABELS,
  type ActiveSimulator,
} from './simulators';

/**
 * Which widgets cannot work under a given simulator, and what to tell the user.
 *
 * The live values come from `simWidgetSupport.json` in the app's user-data
 * folder, next to config.json — edit that file and restart to change them, no
 * rebuild needed. The defaults below seed it on first run and stand in if it is
 * missing or unreadable.
 *
 * Nothing here touches the user's own enabled/disabled choice. A widget listed
 * for the running sim is hidden and rendered as if it were switched off, and
 * its saved setting is left exactly as it was, so it comes back when the sim
 * changes or the widget gains support.
 */
export interface SimWidgetSupportConfig {
  /** Shown when hovering a disabled widget, and under its greyed-out toggle. */
  message: string;
  /**
   * Widget ids as used in WIDGET_MAP and in menuItems.ts (`widgetType`), not
   * display names.
   */
  disabledWidgets: Record<ActiveSimulator, string[]>;
}

/**
 * The widgets verified to work under Le Mans Ultimate.
 *
 * LMU's data comes from a shared-memory block and a local REST API that carry
 * a fraction of what iRacing publishes, so support is per widget and has to be
 * established one at a time. This is the list that has been, and it is the
 * reason for the one below rather than a second opinion about it: a spec
 * asserts the two are exact complements over WIDGET_MAP, so a widget added to
 * the app cannot quietly appear under LMU without someone deciding which list
 * it belongs in.
 */
export const LMU_SUPPORTED_WIDGETS: readonly string[] = [
  'battle',
  'cornername',
  'flag',
  'infobar',
  'input',
  'laptrace',
  'pitlanehelper',
  'relative',
  'standings',
  // Not a sim-specific widget: it reports whatever channels the running sim
  // publishes, which is how LMU's own mapping gets checked. It is also the
  // one widget absent from the settings menu, so there would be no toggle to
  // grey out if it were listed as unsupported.
  'telemetryinspector',
];

/** Everything else, hidden while LMU is the running sim. */
export const LMU_DISABLED_WIDGETS: readonly string[] = [
  'blindspotmonitor',
  'carsystems',
  'deltaspeed',
  'fastercarsfrombehind',
  'flatmap',
  'fuel',
  'gantry',
  'garagecover',
  'heartrate',
  'laptimelog',
  'map',
  'radar',
  'rejoin',
  'sectordelta',
  'shiftlight',
  'slowcarahead',
  'tachometer',
  'twitchchat',
  'weather',
  'wind',
];

/**
 * Seeds the JSON on first run, and the fallback if it cannot be read.
 *
 * Only widgets that exist in this build may be named here — a spec asserts it,
 * because a typo in a list of ids otherwise disables nothing at all and does it
 * silently. A simulator whose source is not in the tree still gets an entry:
 * the list is knowledge about that sim, not code for it, and having it here
 * means the entry is already correct when the source arrives.
 */
export const DEFAULT_SIM_WIDGET_SUPPORT: SimWidgetSupportConfig = {
  message: 'This widget is not compatible with the running sim',
  disabledWidgets: {
    iracing: [],
    lmu: [...LMU_DISABLED_WIDGETS],
  },
};

/**
 * Bumped whenever the lists above change.
 *
 * The file is seeded once and then belongs to the user, so a shipped change
 * would otherwise never reach anyone who had already run the app -- the whole
 * point of these lists is that the app ships knowledge about which widgets
 * work under which sim, and that knowledge improves between releases. The
 * storage layer replaces an older file with the current defaults and logs that
 * it did, which costs a user their hand edits once per change and is why the
 * number is bumped only for a real one.
 */
export const SIM_WIDGET_SUPPORT_VERSION = 4;

/**
 * Whether a widget is unavailable under the running sim.
 *
 * An unknown simulator — nothing detected yet, or demo mode — disables
 * nothing: with no sim to be incompatible with, hiding widgets would be
 * guessing.
 */
export const isWidgetDisabledForSim = (
  config: SimWidgetSupportConfig,
  widgetId: string | undefined,
  simulator: ActiveSimulator | null | undefined
): boolean =>
  !!widgetId &&
  !!simulator &&
  (config.disabledWidgets[simulator] ?? []).includes(widgetId);

/** The hover text for a disabled widget, or null when it is available. */
export const widgetDisabledMessage = (
  config: SimWidgetSupportConfig,
  widgetId: string | undefined,
  simulator: ActiveSimulator | null | undefined
): string | null =>
  isWidgetDisabledForSim(config, widgetId, simulator) ? config.message : null;

/** The label under a greyed-out toggle, e.g. "Not iRacing compatible". */
export const widgetIncompatibleLabel = (
  simulator: ActiveSimulator | null | undefined
): string | null =>
  simulator ? `Not ${SIMULATOR_LABELS[simulator]} compatible` : null;

/**
 * Every widget id this build has.
 *
 * Derived from the two LMU lists rather than kept as a third one, because a
 * spec already asserts those two are exact complements over WIDGET_MAP -- so
 * this set is correct for free, and cannot drift from the widgets that exist.
 *
 * Needed because the config comes from a file a user edits by hand, and a
 * misspelled id used to do nothing at all: it stayed in the list, matched no
 * widget, and the widget it was meant to hide simply stayed on screen with
 * nothing said anywhere.
 */
export const KNOWN_WIDGET_IDS: readonly string[] = [
  ...LMU_SUPPORTED_WIDGETS,
  ...LMU_DISABLED_WIDGETS,
];

/** What a hand-edited file got wrong, for the caller to report. */
export interface SimWidgetSupportProblems {
  /** Ids no widget in this build answers to, with the sim that listed them. */
  unknownWidgets: { simulator: string; id: string }[];
  /** Keys under disabledWidgets that are not simulators. */
  unknownSimulators: string[];
}

export interface NormalizedSimWidgetSupport {
  config: SimWidgetSupportConfig;
  problems: SimWidgetSupportProblems;
}

/**
 * Repairs whatever was read from disk, and says what it had to repair.
 *
 * Unknown ids are dropped rather than kept. Keeping them was harmless to the
 * lookup -- nothing matches -- but it made a typo indistinguishable from a
 * widget that genuinely has no support, which is the one mistake a hand-edited
 * list of ids invites. Dropping them and naming them in the log turns a silent
 * no-op into a line that says which word was wrong.
 *
 * An unrecognised simulator key is worth reporting for a sharper reason: the
 * list for a simulator the file does not mention falls back to the shipped
 * defaults, so a misspelled "Imu" does not disable nothing -- it quietly
 * reinstates the whole bundled list.
 */
export const normalizeSimWidgetSupportVerbose = (
  raw: unknown
): NormalizedSimWidgetSupport => {
  const source = (raw ?? {}) as Partial<SimWidgetSupportConfig>;
  const known = new Set(KNOWN_WIDGET_IDS);
  const unknownWidgets: { simulator: string; id: string }[] = [];

  const listFor = (simulator: ActiveSimulator): string[] => {
    const value = source.disabledWidgets?.[simulator];
    if (!Array.isArray(value)) {
      return [...DEFAULT_SIM_WIDGET_SUPPORT.disabledWidgets[simulator]];
    }
    const ids = value.filter((id): id is string => typeof id === 'string');
    for (const id of ids) {
      if (!known.has(id)) unknownWidgets.push({ simulator, id });
    }
    return ids.filter((id) => known.has(id));
  };

  const simulators = new Set<string>(SIMULATOR_IDS);
  const unknownSimulators = Object.keys(
    (source.disabledWidgets ?? {}) as Record<string, unknown>
  ).filter((key) => !simulators.has(key));

  return {
    config: {
      message:
        typeof source.message === 'string' && source.message.length > 0
          ? source.message
          : DEFAULT_SIM_WIDGET_SUPPORT.message,
      disabledWidgets: Object.fromEntries(
        SIMULATOR_IDS.map((simulator) => [simulator, listFor(simulator)])
      ) as Record<ActiveSimulator, string[]>,
    },
    problems: { unknownWidgets, unknownSimulators },
  };
};

/**
 * Repairs a hand-edited file rather than crashing on it. Unknown keys are
 * dropped, missing ones fall back to the defaults, and non-string entries are
 * ignored. An empty list is honoured as a deliberate "disable nothing" rather
 * than treated as absent.
 */
export const normalizeSimWidgetSupport = (
  raw: unknown
): SimWidgetSupportConfig => normalizeSimWidgetSupportVerbose(raw).config;
