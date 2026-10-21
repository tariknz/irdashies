import { useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  DotsSixIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
} from '@phosphor-icons/react';
import {
  TAPE_REPLAY_SPEEDS,
  type TapeReplayBridge,
  type TapeReplayCommand,
  type TapeReplayStatus,
} from '@irdashies/types';

function timestamp(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

interface TapeReplayControlsProps {
  status: TapeReplayStatus;
  onCommand: (command: TapeReplayCommand) => void;
  busy?: boolean;
  error?: string;
}

export function TapeReplayControls({
  status,
  onCommand,
  busy = false,
  error,
}: TapeReplayControlsProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const position = draft ?? status.position;
  const seek = (seconds: number) => {
    onCommand({
      type: 'seek',
      seconds: Math.min(status.duration, Math.max(0, seconds)),
    });
  };
  const commitSeek = () => {
    if (draft === null) return;
    seek(draft);
    setDraft(null);
  };
  const buttonClass =
    'flex h-9 items-center justify-center gap-1 rounded px-2 text-slate-200 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-40';

  return (
    <section
      aria-label="Telemetry replay controls"
      className="rounded-lg border border-slate-600 bg-slate-900/95 px-4 py-2 text-sm text-white shadow-xl"
    >
      <header className="flex cursor-move items-center justify-between text-xs text-slate-400 [-webkit-app-region:drag]">
        <span className="flex items-center gap-2">
          <DotsSixIcon size={16} /> Telemetry replay
        </span>
        <span
          role={error ? 'alert' : undefined}
          className={error ? 'text-red-300' : undefined}
        >
          {error ??
            (status.ended
              ? 'End of tape'
              : status.paused
                ? 'Paused'
                : 'Playing')}
        </span>
      </header>
      <div className="mt-2 flex items-center gap-3">
        <span className="w-12 text-right font-mono tabular-nums">
          {timestamp(position)}
        </span>
        <input
          aria-label="Replay position"
          aria-valuetext={`${timestamp(position)} of ${timestamp(status.duration)}`}
          type="range"
          min={0}
          max={status.duration}
          step={0.1}
          value={position}
          disabled={busy || status.duration <= 0}
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          onBlur={commitSeek}
          className="h-5 min-w-0 flex-1 cursor-pointer accent-sky-400"
        />
        <span className="w-12 font-mono text-slate-400 tabular-nums">
          {timestamp(status.duration)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <button
          aria-label="Restart replay"
          title="Restart replay"
          className={buttonClass}
          disabled={busy}
          onClick={() => seek(0)}
        >
          <SkipBackIcon size={18} weight="fill" />
        </button>
        <button
          aria-label="Rewind 10 seconds"
          title="Rewind 10 seconds"
          className={buttonClass}
          disabled={busy}
          onClick={() => seek(status.position - 10)}
        >
          <ArrowCounterClockwiseIcon size={18} />
          <span className="text-xs">10s</span>
        </button>
        <button
          aria-label={
            status.paused || status.ended ? 'Play replay' : 'Pause replay'
          }
          className={`${buttonClass} bg-sky-500/20 text-sky-300`}
          disabled={busy}
          onClick={() =>
            onCommand({
              type: 'pause',
              paused: !status.paused && !status.ended,
            })
          }
        >
          {status.paused || status.ended ? (
            <PlayIcon size={20} weight="fill" />
          ) : (
            <PauseIcon size={20} weight="fill" />
          )}
        </button>
        <button
          aria-label="Fast forward 10 seconds"
          title="Fast forward 10 seconds"
          className={buttonClass}
          disabled={busy}
          onClick={() => seek(status.position + 10)}
        >
          <span className="text-xs">10s</span>
          <ArrowClockwiseIcon size={18} />
        </button>
        <label className="ml-3 flex items-center gap-2 text-xs text-slate-400">
          Speed
          <select
            aria-label="Playback speed"
            value={status.speed}
            disabled={busy}
            onChange={(event) =>
              onCommand({ type: 'speed', speed: Number(event.target.value) })
            }
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus-visible:outline-sky-400"
          >
            {!TAPE_REPLAY_SPEEDS.some((speed) => speed === status.speed) && (
              <option value={status.speed}>{status.speed}x</option>
            )}
            {TAPE_REPLAY_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

/** Poll only the small transport status, at 5 Hz, while this window is mounted. */
export function TapeReplayOverlay({
  bridge = window.tapeReplayBridge,
}: {
  bridge?: TapeReplayBridge;
}) {
  const [status, setStatus] = useState<TapeReplayStatus | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const commandPending = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let polling = false;
    const poll = async () => {
      if (polling || commandPending.current) return;
      polling = true;
      const version = revision.current;
      try {
        const next = await bridge.getStatus();
        if (active && version === revision.current) setStatus(next);
      } catch {
        if (active) setError('Could not read replay status');
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bridge]);

  const command = async (next: TapeReplayCommand) => {
    if (!bridge || commandPending.current) return;
    commandPending.current = true;
    revision.current++;
    setBusy(true);
    try {
      setStatus(await bridge.command(next));
      setError(undefined);
    } catch {
      setError('Could not update replay playback');
    } finally {
      commandPending.current = false;
      setBusy(false);
    }
  };

  return status ? (
    <TapeReplayControls
      status={status}
      busy={busy}
      error={error}
      onCommand={(next) => void command(next)}
    />
  ) : (
    <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
      {error ?? 'Waiting for telemetry replay…'}
    </div>
  );
}
