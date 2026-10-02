import { useCallback, useEffect, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type RadarConfig,
  type RadarPoleSides,
} from '@irdashies/types';

const RADAR_DEFAULTS = getWidgetDefaultConfig('radar');

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
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const unknown = Object.keys(parsed).filter(
        (key) => !(key in RADAR_DEFAULTS)
      );
      if (unknown.length) {
        setMessage(`Unknown settings: ${unknown.join(', ')}`);
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
