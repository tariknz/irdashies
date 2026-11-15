import { useEffect, useState } from 'react';
import type { IbtInspectorStatus, TapeReplayCommand } from '@irdashies/types';

const button =
  'rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';
const input =
  'mt-1 block w-28 rounded border border-slate-600 bg-slate-800 px-2 py-2 text-white';

export function ReplayDevelopmentControls({
  status,
  busy,
  onCommand,
  onSave,
  onRestore,
}: {
  status: IbtInspectorStatus;
  busy: boolean;
  onCommand?: (command: TapeReplayCommand) => void;
  onSave: () => void;
  onRestore: () => void;
}) {
  const playback = status.playback;
  const [seekTo, setSeekTo] = useState('');
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('10');
  const loopStart = playback?.loop?.start;
  const loopEnd = playback?.loop?.end;
  useEffect(() => {
    if (loopStart !== undefined && loopEnd !== undefined) {
      setStart(String(loopStart));
      setEnd(String(loopEnd));
    }
  }, [loopStart, loopEnd]);
  const locked = busy || !playback || status.capture.active || !onCommand;
  const validRange =
    start !== '' &&
    end !== '' &&
    Number.isFinite(Number(start)) &&
    Number.isFinite(Number(end)) &&
    Number(start) >= 0 &&
    Number(end) > Number(start) &&
    Number(end) <= (playback?.duration ?? 0);
  return (
    <div className="mt-4 border-t border-slate-700 pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          Position (seconds)
          <input
            aria-label="Seek position"
            type="number"
            min="0"
            max={playback?.duration ?? 0}
            step="0.001"
            value={seekTo}
            placeholder={playback?.position.toFixed(3) ?? '0'}
            onChange={(event) => setSeekTo(event.target.value)}
            disabled={locked}
            className={input}
          />
        </label>
        <button
          className={button}
          disabled={
            locked ||
            seekTo === '' ||
            !Number.isFinite(Number(seekTo)) ||
            Number(seekTo) < 0 ||
            Number(seekTo) > (playback?.duration ?? 0)
          }
          onClick={() => onCommand?.({ type: 'seek', seconds: Number(seekTo) })}
        >
          Seek
        </button>
        <button
          className={button}
          disabled={locked}
          onClick={() => onCommand?.({ type: 'seek', seconds: 0 })}
        >
          Restart
        </button>
        <button
          className={button}
          disabled={
            locked || !playback?.paused || playback.ended || !playback.canStep
          }
          onClick={() => onCommand?.({ type: 'step' })}
        >
          Next frame
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          A (seconds)
          <input
            aria-label="Loop start"
            type="number"
            min="0"
            step="0.001"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            disabled={locked}
            className={input}
          />
        </label>
        <button
          className={button}
          disabled={locked}
          onClick={() => setStart(String(playback?.position ?? 0))}
        >
          Set A
        </button>
        <label className="text-xs text-slate-400">
          B (seconds)
          <input
            aria-label="Loop end"
            type="number"
            min="0"
            step="0.001"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            disabled={locked}
            className={input}
          />
        </label>
        <button
          className={button}
          disabled={locked}
          onClick={() => setEnd(String(playback?.position ?? 0))}
        >
          Set B
        </button>
        <button
          className={button}
          disabled={locked || !validRange}
          onClick={() =>
            onCommand?.({
              type: 'loop',
              range: { start: Number(start), end: Number(end) },
            })
          }
        >
          Loop A–B
        </button>
        <button
          className={button}
          disabled={locked || !playback?.loop}
          onClick={() => onCommand?.({ type: 'loop', range: null })}
        >
          Clear loop
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {playback?.loop
          ? `Loop active: ${playback.loop.start.toFixed(3)}–${playback.loop.end.toFixed(3)} s`
          : 'Loop off'}
        . Seeking resets widget history; it does not reconstruct earlier laps.
        Stop capture to seek, step or change the loop.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          className={button}
          disabled={busy || !playback || status.capture.active}
          onClick={onSave}
        >
          Save scenario
        </button>
        <button
          className={button}
          disabled={busy || status.capture.active}
          onClick={onRestore}
        >
          Restore scenario
        </button>
      </div>
      {!!status.coverage?.length && (
        <section className="mt-4 rounded border border-slate-700 p-3">
          <h2 className="text-sm font-semibold">Recording coverage</h2>
          <p className="mt-1 text-xs text-slate-400">
            Baseline field checks for enabled widgets. Field presence does not
            prove changing values, session events or complete behavior.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {status.coverage.map((item) => (
              <li
                key={item.widget}
                className={
                  item.status === 'missing-fields'
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }
              >
                <span className="font-semibold">{item.widget}</span>:{' '}
                {item.status === 'missing-fields'
                  ? `Missing ${item.missing.join(', ')}`
                  : item.status === 'unknown'
                    ? 'Requirements not yet audited'
                    : 'Baseline fields present'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
