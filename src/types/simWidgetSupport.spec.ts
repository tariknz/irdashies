import { describe, expect, it } from 'vitest';
import { WIDGET_MAP } from '../frontend/WidgetIndex';
import { widgetItems } from '../frontend/components/Settings/menuItems';
import { SIMULATOR_IDS } from './simulators';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  LMU_DISABLED_WIDGETS,
  LMU_SUPPORTED_WIDGETS,
  isWidgetDisabledForSim,
  KNOWN_WIDGET_IDS,
  normalizeSimWidgetSupport,
  normalizeSimWidgetSupportVerbose,
  widgetDisabledMessage,
  widgetIncompatibleLabel,
  type SimWidgetSupportConfig,
} from './simWidgetSupport';

/**
 * A config that actually disables something.
 *
 * The shipped defaults disable nothing for any simulator, so they cannot
 * demonstrate the lookup -- these specs are about the function, not about
 * which widgets happen to be listed today.
 */
const configured: SimWidgetSupportConfig = {
  message: DEFAULT_SIM_WIDGET_SUPPORT.message,
  disabledWidgets: { iracing: [], lmu: ['blindspotmonitor'] },
};

const config = DEFAULT_SIM_WIDGET_SUPPORT;

const allDefaultIds = SIMULATOR_IDS.flatMap(
  (simulator) => config.disabledWidgets[simulator]
);

describe('per-simulator widget support', () => {
  it('names only widgets that actually exist', () => {
    // A typo here would silently disable nothing at all, which is the one
    // failure mode of a hand-maintained list of ids. This is also what stops
    // the defaults naming a widget that only exists on another branch.
    const known = new Set(Object.keys(WIDGET_MAP));
    expect(allDefaultIds.filter((id) => !known.has(id))).toEqual([]);
  });

  it('names only widgets the settings menu can grey out', () => {
    const inMenu = new Set(
      widgetItems.map((item) => item.widgetType).filter(Boolean)
    );
    expect(allDefaultIds.filter((id) => !inMenu.has(id))).toEqual([]);
  });

  it('covers every known simulator', () => {
    // A sim id with no entry would throw on lookup rather than simply
    // disabling nothing.
    SIMULATOR_IDS.forEach((simulator) => {
      expect(Array.isArray(config.disabledWidgets[simulator])).toBe(true);
    });
  });

  it('disables a widget only under the sim that lists it', () => {
    expect(isWidgetDisabledForSim(configured, 'blindspotmonitor', 'lmu')).toBe(
      true
    );
    expect(
      isWidgetDisabledForSim(configured, 'blindspotmonitor', 'iracing')
    ).toBe(false);
    expect(isWidgetDisabledForSim(configured, 'standings', 'lmu')).toBe(false);
    expect(isWidgetDisabledForSim(configured, 'standings', 'iracing')).toBe(
      false
    );
  });

  it('hides nothing under iRacing', () => {
    // iRacing is the sim every widget is written against, so the list exists
    // for the other direction only.
    expect(config.disabledWidgets.iracing).toEqual([]);
  });

  it('hides everything under LMU that is not on its supported list', () => {
    expect(config.disabledWidgets.lmu).toEqual([...LMU_DISABLED_WIDGETS]);
    LMU_SUPPORTED_WIDGETS.forEach((id) => {
      expect(isWidgetDisabledForSim(config, id, 'lmu')).toBe(false);
    });
    LMU_DISABLED_WIDGETS.forEach((id) => {
      expect(isWidgetDisabledForSim(config, id, 'lmu')).toBe(true);
    });
  });

  it('accounts for every widget in the build under LMU', () => {
    // The guard that makes two hand-kept lists safe. A widget added to the app
    // and to neither list would quietly appear under LMU unverified; one added
    // to both would be hidden while claiming to be supported.
    const all = Object.keys(WIDGET_MAP).sort();
    const listed = [...LMU_SUPPORTED_WIDGETS, ...LMU_DISABLED_WIDGETS].sort();

    expect(listed).toEqual(all);
  });

  it('disables nothing while no simulator is known', () => {
    // Nothing detected yet, or demo mode. Hiding widgets would be guessing at
    // which sim the user is about to run.
    expect(isWidgetDisabledForSim(config, 'blindspotmonitor', null)).toBe(
      false
    );
    expect(isWidgetDisabledForSim(config, 'blindspotmonitor', undefined)).toBe(
      false
    );
    expect(widgetDisabledMessage(config, 'blindspotmonitor', null)).toBeNull();
  });

  it('gives a message only for a widget that is actually disabled', () => {
    expect(widgetDisabledMessage(configured, 'blindspotmonitor', 'lmu')).toBe(
      configured.message
    );
    expect(widgetDisabledMessage(configured, 'standings', 'lmu')).toBeNull();
  });

  it('names the sim in the toggle label', () => {
    expect(widgetIncompatibleLabel('iracing')).toBe('Not iRacing compatible');
    expect(widgetIncompatibleLabel('lmu')).toBe(
      'Not Le Mans Ultimate compatible'
    );
    expect(widgetIncompatibleLabel(null)).toBeNull();
  });

  it('uses whatever the file says, not the defaults', () => {
    // The point of the JSON: an edited file changes behaviour without a
    // rebuild, including for widgets the defaults never mention.
    const edited = normalizeSimWidgetSupport({
      message: 'Nope',
      disabledWidgets: { iracing: ['standings'], lmu: [] },
    });
    expect(isWidgetDisabledForSim(edited, 'standings', 'iracing')).toBe(true);
    expect(isWidgetDisabledForSim(edited, 'blindspotmonitor', 'lmu')).toBe(
      false
    );
    expect(widgetDisabledMessage(edited, 'standings', 'iracing')).toBe('Nope');
  });

  it('repairs a hand-edited file rather than crashing on it', () => {
    // Someone editing JSON by hand will eventually delete a key or leave a
    // stray value; none of that may take the app down.
    expect(normalizeSimWidgetSupport(undefined)).toEqual(
      DEFAULT_SIM_WIDGET_SUPPORT
    );
    expect(normalizeSimWidgetSupport({}).disabledWidgets.lmu).toEqual(
      DEFAULT_SIM_WIDGET_SUPPORT.disabledWidgets.lmu
    );

    const partial = normalizeSimWidgetSupport({
      disabledWidgets: { iracing: ['standings', 42, null] },
    });
    // Missing sim falls back to defaults; non-strings are dropped.
    expect(partial.disabledWidgets.iracing).toEqual(['standings']);
    expect(partial.disabledWidgets.lmu).toEqual(
      DEFAULT_SIM_WIDGET_SUPPORT.disabledWidgets.lmu
    );
    expect(partial.message).toBe(DEFAULT_SIM_WIDGET_SUPPORT.message);

    // An empty list is a deliberate "disable nothing", not a missing key.
    expect(
      normalizeSimWidgetSupport({ disabledWidgets: { iracing: [], lmu: [] } })
        .disabledWidgets.lmu
    ).toEqual([]);
  });
});

describe('a hand-edited file with a mistake in it', () => {
  it('knows every widget in the build', () => {
    expect([...KNOWN_WIDGET_IDS].sort()).toEqual(
      Object.keys(WIDGET_MAP).sort()
    );
  });

  it('drops an id no widget answers to, and says which', () => {
    // The mistake this exists for. Kept, it matched nothing and the widget it
    // was meant to hide stayed on screen with nothing said anywhere.
    const { config, problems } = normalizeSimWidgetSupportVerbose({
      disabledWidgets: { iracing: [], lmu: ['fuelcalculator', 'carsystems'] },
    });

    expect(config.disabledWidgets.lmu).toEqual(['carsystems']);
    expect(problems.unknownWidgets).toEqual([
      { simulator: 'lmu', id: 'fuelcalculator' },
    ]);
  });

  it('reports a section that is not a simulator', () => {
    // Worth saying because the fallback is not "disable nothing": a simulator
    // the file does not mention takes the shipped defaults instead.
    const { config, problems } = normalizeSimWidgetSupportVerbose({
      disabledWidgets: { iracing: [], LMU: ['carsystems'] },
    });

    expect(problems.unknownSimulators).toEqual(['LMU']);
    expect(config.disabledWidgets.lmu).toEqual(
      DEFAULT_SIM_WIDGET_SUPPORT.disabledWidgets.lmu
    );
  });

  it('reports nothing when the file is correct', () => {
    const { problems } = normalizeSimWidgetSupportVerbose({
      disabledWidgets: { iracing: [], lmu: ['carsystems'] },
    });

    expect(problems.unknownWidgets).toEqual([]);
    expect(problems.unknownSimulators).toEqual([]);
  });

  it('still disables nothing for an empty list', () => {
    // An empty list is a deliberate choice, not a mistake.
    const { config, problems } = normalizeSimWidgetSupportVerbose({
      disabledWidgets: { iracing: [], lmu: [] },
    });

    expect(config.disabledWidgets.lmu).toEqual([]);
    expect(problems.unknownWidgets).toEqual([]);
  });
});
