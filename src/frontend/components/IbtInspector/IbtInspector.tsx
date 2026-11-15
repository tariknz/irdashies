import { ReplayDevelopmentControls } from './ReplayDevelopmentControls';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowClockwiseIcon,
  BugIcon,
  FileTextIcon,
  FolderOpenIcon,
  PauseIcon,
  PlayIcon,
  RecordIcon,
  StopIcon,
} from '@phosphor-icons/react';
import type {
  IbtFile,
  IbtInspectorBridge,
  IbtInspectorStatus,
  TapeReplayCommand,
} from '@irdashies/types';
import { PerformanceTelemetry } from './PerformanceTelemetry';

const emptyStatus: IbtInspectorStatus = {
  file: null,
  playback: null,
  warnings: [],
  capture: {
    active: false,
    samples: 0,
    reportPath: null,
    error: null,
    telemetry: [],
    memoryCheckpoints: [],
    baseline: null,
    heapSampling: { attachedTargets: 0, skippedTargets: 0 },
    hottestSections: [],
    channelActivity: [],
  },
};
const button =
  'inline-flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export interface IbtInspectorViewProps {
  directory: string;
  files: IbtFile[];
  selected: string;
  speed: string;
  status: IbtInspectorStatus;
  busy: boolean;
  error: string | null;
  truncated?: boolean;
  onSelect: (name: string) => void;
  onSpeed: (speed: string) => void;
  onCommand?: (command: TapeReplayCommand) => void;
  onAction: (
    action:
      | 'refresh'
      | 'load'
      | 'pause'
      | 'stop'
      | 'capture'
      | 'memoryCheckpoint'
      | 'report'
      | 'saveScenario'
      | 'restoreScenario'
  ) => void;
}

export function IbtInspectorView({
  directory,
  files,
  selected,
  speed,
  status,
  busy,
  error,
  truncated,
  onSelect,
  onSpeed,
  onAction,
  onCommand,
}: IbtInspectorViewProps) {
  const playback = status.playback;
  return (
    <main className="flex min-h-screen flex-col gap-5 bg-slate-900 p-6 font-sans text-slate-100">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <BugIcon size={24} className="text-sky-400" />
            IBT Inspector
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Replay telemetry in your current overlays and capture performance.
          </p>
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() => onAction('refresh')}
        >
          <ArrowClockwiseIcon size={16} />
          Refresh
        </button>
      </header>
      <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/40">
        <div className="border-b border-slate-700 p-3">
          <h2 className="text-sm font-semibold">Telemetry recordings</h2>
          <p className="mt-1 break-all text-xs text-slate-400">
            {directory || 'Loading telemetry directory…'}
          </p>
        </div>
        <div
          role="listbox"
          aria-label="IBT recordings"
          className="max-h-64 overflow-y-auto"
        >
          {files.length ? (
            files.map((file) => (
              <button
                key={file.name}
                type="button"
                role="option"
                aria-selected={selected === file.name}
                disabled={busy}
                onClick={() => onSelect(file.name)}
                className={`flex w-full items-center gap-3 border-b border-slate-700/60 px-4 py-3 text-left last:border-0 hover:bg-slate-700/50 ${selected === file.name ? 'bg-sky-500/10 text-sky-200' : 'text-slate-200'}`}
              >
                <FileTextIcon size={20} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm">{file.name}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {new Date(file.modifiedAt).toLocaleString()} ·{' '}
                    {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </span>
                <span
                  className={`h-3 w-3 shrink-0 rounded-full border ${selected === file.name ? 'border-sky-400 bg-sky-400' : 'border-slate-500'}`}
                />
              </button>
            ))
          ) : (
            <p className="p-6 text-sm text-slate-400">
              No IBT files found. Record telemetry in iRacing, then refresh this
              list.
            </p>
          )}
        </div>
        {truncated && (
          <p className="p-3 text-xs text-amber-300">
            Showing up to 500 files. Move older recordings out of this directory
            to see more.
          </p>
        )}
      </section>
      <section className="rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Load speed
            <select
              aria-label="Load speed"
              value={speed}
              disabled={busy}
              onChange={(event) => onSpeed(event.target.value)}
              className="mt-1 block rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              {['0.5', '1', '2', '4', '10', 'max'].map((value) => (
                <option key={value} value={value}>
                  {value === 'max' ? 'Maximum throughput' : `${value}×`}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`${button} border-sky-500/50 bg-sky-500/15 text-sky-200`}
            disabled={busy || !selected || status.capture.active}
            onClick={() => onAction('load')}
          >
            <PlayIcon size={16} weight="fill" />
            Load recording
          </button>
          <button
            className={button}
            disabled={busy || !playback || playback.ended}
            onClick={() => onAction('pause')}
          >
            {playback?.paused ? (
              <PlayIcon size={16} />
            ) : (
              <PauseIcon size={16} />
            )}{' '}
            {playback?.paused ? 'Play' : 'Pause'}
          </button>
          <button
            className={button}
            disabled={busy || !playback}
            onClick={() => onAction('stop')}
          >
            <StopIcon size={16} />
            Stop replay
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span className="truncate">
            {busy ? 'Working…' : (status.file ?? 'No recording loaded')}
          </span>
          <span className="shrink-0 font-mono">
            {playback
              ? `${time(playback.position)} / ${time(playback.duration)} · ${playback.ended ? 'Finished' : playback.paused ? 'Paused' : playback.maximumSpeed ? 'Max' : 'Playing'}`
              : 'Ready'}
          </span>
        </div>
        <progress
          aria-label="Replay progress"
          max={playback?.duration || 1}
          value={playback?.position || 0}
          className="mt-2 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-sky-400"
        />
        {playback && (
          <p className="mt-2 text-xs text-slate-400">
            SDK frames:{' '}
            {playback.framesDelivered?.toLocaleString() ?? 'unavailable'} ·
            Source frames:{' '}
            {playback.framesConsumed?.toLocaleString() ?? 'unavailable'}
          </p>
        )}
        <ReplayDevelopmentControls
          status={status}
          busy={busy}
          onCommand={onCommand}
          onSave={() => onAction('saveScenario')}
          onRestore={() => onAction('restoreScenario')}
        />
      </section>
      <section className="rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Performance capture</h2>
            <p className="mt-1 text-xs text-slate-400">
              {status.capture.active
                ? `Recording · ${status.capture.samples} reports · ${status.capture.memoryCheckpoints.length} GC checkpoints`
                : `${status.capture.samples} reports · ${status.capture.memoryCheckpoints.length} GC checkpoints`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={
                busy || !playback || (!status.capture.active && playback.ended)
              }
              onClick={() => onAction('capture')}
            >
              {status.capture.active ? (
                <StopIcon size={16} />
              ) : (
                <RecordIcon size={16} className="text-red-400" />
              )}
              {status.capture.active ? 'Stop capture' : 'Start capture'}
            </button>
            {status.capture.active && (
              <button
                className={button}
                disabled={
                  busy || status.capture.heapSampling.attachedTargets === 0
                }
                title="Forces garbage collection in attached renderer windows; they may pause briefly. The main process is not collected."
                onClick={() => onAction('memoryCheckpoint')}
              >
                <ArrowClockwiseIcon size={16} />
                Post-GC checkpoint
              </button>
            )}
            <button
              className={button}
              disabled={
                busy || status.capture.active || !status.capture.reportPath
              }
              onClick={() => onAction('report')}
            >
              <FolderOpenIcon size={16} />
              Show report
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Captures application and per-process CPU/memory, main and renderer V8
          heap, event-loop delay, processing sections and channel counters.
          Metrics include overlay, Inspector and Settings overhead. Heap
          sampling uses CDP and may add diagnostic overhead. The optional
          checkpoint forces GC in attached renderer windows only; the main
          process remains live. Renderer draw timings, GPU-engine utilization
          and game FPS are not measured. Maximum speed tests throughput.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Keeps the 10 most recent captures, up to 64 MB or one hour each.
          Post-GC checkpoints affect renderers only; main heap and OS process
          memory remain live measurements.
        </p>
        {status.capture.reportPath && !status.capture.active && (
          <p className="mt-2 break-all text-xs text-slate-400">
            {status.capture.reportPath}
          </p>
        )}
      </section>
      <PerformanceTelemetry capture={status.capture} />
      {status.warnings.length > 0 && (
        <aside className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
          <ul className="list-disc space-y-1 pl-4">
            {status.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </aside>
      )}
      {(error || status.capture.error || playback?.failed) && (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error ??
            status.capture.error ??
            (playback?.error || 'Replay source failed')}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Stop replay to return to your previous telemetry source. Close this
        window to keep playback running; disable Dev Tool to stop it.
      </p>
    </main>
  );
}

export function IbtInspector({
  bridge = window.ibtInspectorBridge,
}: {
  bridge?: IbtInspectorBridge;
}) {
  const [directory, setDirectory] = useState('');
  const [files, setFiles] = useState<IbtFile[]>([]);
  const [selected, setSelected] = useState('');
  const [speed, setSpeed] = useState('1');
  const [status, setStatus] = useState(emptyStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const pending = useRef(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!bridge) throw new Error('Inspector is available in the desktop app');
    const result = await bridge.list();
    setDirectory(result.directory);
    setFiles(result.files);
    setTruncated(result.truncated);
    setSelected((current) =>
      result.files.some((f) => f.name === current)
        ? current
        : (result.files[0]?.name ?? '')
    );
  }, [bridge]);
  useEffect(() => {
    void refresh().catch((error) => setError(String(error)));
  }, [refresh]);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let polling = false;
    const poll = async () => {
      if (polling || pending.current) return;
      polling = true;
      const version = revision.current;
      try {
        const next = await bridge.status();
        if (active && !pending.current && revision.current === version)
          setStatus(next);
      } catch (error) {
        if (active) setError(String(error));
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bridge]);
  const action = async (
    name: Parameters<IbtInspectorViewProps['onAction']>[0] | 'command',
    command?: TapeReplayCommand
  ) => {
    if (!bridge || pending.current) return;
    pending.current = true;
    revision.current++;
    setBusy(true);
    setError(null);
    try {
      if (name === 'command' && command) await bridge.command(command);
      if (name === 'saveScenario') await bridge.saveScenario();
      if (name === 'restoreScenario') {
        const scenario = await bridge.getScenario();
        if (!scenario)
          throw new Error(
            'No saved scenario. Load a recording and save it first.'
          );
        await bridge.load(scenario.file, scenario.speed);
        await bridge.command({ type: 'seek', seconds: scenario.position });
        if (scenario.loop)
          await bridge.command({ type: 'loop', range: scenario.loop });
        setSelected(scenario.file);
        setSpeed(String(scenario.speed));
      }
      if (name === 'refresh') await refresh();
      if (name === 'load')
        await bridge.load(selected, speed === 'max' ? 'max' : Number(speed));
      if (name === 'pause')
        await bridge.command({
          type: 'pause',
          paused: !status.playback?.paused,
        });
      if (name === 'stop') await bridge.stop();
      if (name === 'capture') {
        if (status.capture.active) await bridge.stopCapture();
        else {
          await bridge.startCapture();
          await bridge.command({ type: 'pause', paused: false });
        }
      }
      if (name === 'memoryCheckpoint') await bridge.checkpointMemory();
      if (name === 'report') await bridge.showReport();
      setStatus(await bridge.status());
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <IbtInspectorView
      directory={directory}
      files={files}
      selected={selected}
      speed={speed}
      status={status}
      busy={busy}
      error={error}
      truncated={truncated}
      onSelect={setSelected}
      onSpeed={setSpeed}
      onCommand={(command) => void action('command', command)}
      onAction={(name) => void action(name)}
    />
  );
}
