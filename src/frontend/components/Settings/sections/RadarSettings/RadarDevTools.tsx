import { useCallback, useEffect, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  RADAR_ARC_STYLES,
  RADAR_OVERLAP_THRESHOLDS,
  RADAR_PROFILE_KEYS,
  RADAR_RIVAL_COLOR_MODES,
  getWidgetDefaultConfig,
  type RadarConfig,
  type RadarPoleSides,
} from '@irdashies/types';
import { isValidSize, type CarSize } from '@irdashies/domain/radar/carSizes';

const RADAR_DEFAULTS = getWidgetDefaultConfig('radar');
const PROFILE_DEFAULTS: Record<string, unknown> = Object.fromEntries(
  RADAR_PROFILE_KEYS.map((key) => [key, RADAR_DEFAULTS[key]])
);

const kindOf = (value: unknown) =>
  Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

/** Types of the settings that default to null (ovalProfile is checked apart). */
const NULLABLE_KINDS: Record<string, string> = { rivalCustomColor: 'number' };

/** Settings that take one of a few words. */
const CHOICES: Record<string, readonly string[]> = {
  warningArcStyle: RADAR_ARC_STYLES,
  diveArcStyle: RADAR_ARC_STYLES,
  hazardArcStyle: RADAR_ARC_STYLES,
  overlapThreshold: RADAR_OVERLAP_THRESHOLDS,
  rivalColorMode: RADAR_RIVAL_COLOR_MODES,
};

/** Each value, nested ones included, whose type differs from its default. */
const wrongTypes = (
  value: Record<string, unknown>,
  defaults: Record<string, unknown>,
  prefix = ''
): string[] =>
  Object.entries(value).flatMap(([key, item]) => {
    const fallback = defaults[key];
    const path = prefix + key;
    if (fallback === null) {
      // Off by default, so the default says nothing about the type.
      const kind = NULLABLE_KINDS[key];
      return item === null || kindOf(item) === kind
        ? []
        : [`${path} (expected ${kind} or null)`];
    }
    if (fallback === undefined) return [];
    if (kindOf(item) !== kindOf(fallback)) {
      return [`${path} (expected ${kindOf(fallback)})`];
    }
    const choices = CHOICES[key];
    if (choices && !choices.includes(item as string)) {
      return [`${path} (expected one of ${choices.join(', ')})`];
    }
    return kindOf(fallback) === 'object'
      ? wrongTypes(
          item as Record<string, unknown>,
          fallback as Record<string, unknown>,
          `${path}.`
        )
      : [];
  });

/**
 * Every pasted value that would be saved wrong. The oval profile (null until
 * used) and the class sizes (keyed by class name) have no default to compare
 * with, so each is checked against what it holds.
 */
const wrongSettings = (settings: Record<string, unknown>): string[] => {
  const { ovalProfile, classSizes, ...rest } = settings;
  const wrong = wrongTypes(rest, { ...RADAR_DEFAULTS });
  if (ovalProfile != null) {
    if (kindOf(ovalProfile) !== 'object') {
      wrong.push('ovalProfile (expected object or null)');
    } else {
      const profile = ovalProfile as Record<string, unknown>;
      for (const key of Object.keys(profile)) {
        if (!(key in PROFILE_DEFAULTS)) {
          wrong.push(`ovalProfile.${key} (not an oval setting)`);
        }
      }
      wrong.push(...wrongTypes(profile, PROFILE_DEFAULTS, 'ovalProfile.'));
    }
  }
  if (classSizes !== undefined) {
    if (kindOf(classSizes) !== 'object') {
      wrong.push('classSizes (expected object)');
    } else {
      const sizes = classSizes as Record<string, unknown>;
      for (const [name, size] of Object.entries(sizes)) {
        if (!isValidSize(size as CarSize)) {
          wrong.push(`classSizes.${name} (expected a length and width)`);
        }
      }
    }
  }
  return wrong;
};

const BUTTON =
  'px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors';

type Kind = 'grid' | 'pace';
type Side = 'left' | 'right';

/** Learnt pole sides, to correct or forget so they are learnt again. */
export const PoleSidesTable = () => {
  const { bridge } = useDashboard();
  const [sides, setSides] = useState<RadarPoleSides | null>(null);

  const reload = useCallback(() => {
    bridge.getRadarPoleSides?.().then(setSides);
  }, [bridge]);
  useEffect(reload, [reload]);

  if (!bridge.getRadarPoleSides) {
    return (
      <p className="text-sm text-slate-500">
        Only available in the desktop app.
      </p>
    );
  }
  const rows = Object.entries(sides ?? {}).flatMap(([track, byKind]) =>
    (Object.entries(byKind) as [Kind, Side][]).map(([kind, side]) => ({
      track,
      kind,
      side,
    }))
  );

  const change = async (track: string, kind: Kind, side: Side | null) => {
    await bridge.setRadarPoleSide?.(track, kind, side);
    reload();
  };

  return (
    <div className="space-y-2">
      <h4 className="text-md font-medium text-slate-300">Learnt Pole Sides</h4>
      <p className="text-sm text-slate-500">
        Learnt from the spotter after the green. A change applies from the next
        session.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing learnt yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1 pr-2 font-medium">Track</th>
                <th className="py-1 pr-2 font-medium">Start</th>
                <th className="py-1 pr-2 font-medium">Pole side</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ track, kind, side }) => (
                <tr
                  key={`${track}:${kind}`}
                  className="border-t border-slate-700"
                >
                  <td className="py-1 pr-2 text-slate-300">{track}</td>
                  <td className="py-1 pr-2 text-slate-400">
                    {kind === 'grid' ? 'Standing grid' : 'Pace line'}
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label={`Pole side at ${track}`}
                      className="bg-slate-700 text-white rounded-md px-2 py-0.5"
                      value={side}
                      onChange={(e) =>
                        change(track, kind, e.target.value as Side)
                      }
                    >
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-red-400"
                      onClick={() => change(track, kind, null)}
                    >
                      Forget
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** The radar config as JSON, to copy out or paste back in. */
export const ConfigJson = ({
  config,
  onApply,
}: {
  config: RadarConfig;
  onApply: (change: Partial<RadarConfig>) => void;
}) => {
  const current = JSON.stringify(config, null, 2);
  const [text, setText] = useState(current);
  const [edited, setEdited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!edited) setText(current);
  }, [current, edited]);

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setMessage('Expected a JSON object of settings.');
        return;
      }
      const unknown = Object.keys(parsed).filter(
        (key) => !(key in RADAR_DEFAULTS)
      );
      if (unknown.length) {
        setMessage(`Unknown settings: ${unknown.join(', ')}`);
        return;
      }
      // A wrong type would be saved as is and break the radar, e.g. a null
      // tuning drops every tuning default when spread over them.
      const wrong = wrongSettings(parsed as Record<string, unknown>);
      if (wrong.length) {
        setMessage(`Wrong type: ${wrong.join(', ')}`);
        return;
      }
      onApply(parsed as Partial<RadarConfig>);
      setEdited(false);
      setMessage('Applied.');
    } catch (error) {
      setMessage(`Not valid JSON: ${(error as Error).message}`);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied.');
    } catch {
      setMessage('Could not copy; select the text and copy it by hand.');
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-md font-medium text-slate-300">Export / Import</h4>
      <textarea
        aria-label="Radar settings as JSON"
        spellCheck={false}
        className="w-full h-48 rounded-md bg-slate-900 text-slate-200 font-mono text-xs p-2 border border-slate-700"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setEdited(true);
          setMessage(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON} onClick={copy}>
          Copy
        </button>
        <button type="button" className={BUTTON} onClick={apply}>
          Apply Pasted
        </button>
        {edited && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              setEdited(false);
              setMessage(null);
            }}
          >
            Discard
          </button>
        )}
        {message && <span className="text-xs text-slate-400">{message}</span>}
      </div>
    </div>
  );
};
