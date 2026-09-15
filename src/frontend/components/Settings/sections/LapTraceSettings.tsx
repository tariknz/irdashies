import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowSquareOutIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  LapTraceWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
  DEFAULT_AUDIO_OUTPUT_DEVICE_ID,
  DEFAULT_LAP_TRACE_COLORS,
  DEFAULT_LAP_TRACE_SOUND,
} from '@irdashies/types';
import type {
  LapTraceBestInfo,
  Garage61SearchInfo,
  LapTraceColors,
  LapTraceSoundCue,
  BrakeCueSound,
} from '@irdashies/types';
import { useDashboard, useLapTraceStore } from '@irdashies/context';
import {
  GARAGE61_IMPORT_CAR_PATH,
  GARAGE61_IMPORT_TRACK_ID,
} from '../../../domain/lapTrace/garage61CsvImport';
import { MAX_METERS_BEHIND } from '../../../domain/lapTrace/lapTraceWindow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { LapTraceHelp } from './LapTraceHelp';
import {
  playBrakeCue,
  setBrakeCueOutputDevice,
} from '@irdashies/utils/brakeCueAudio';
import { useAudioOutputDevices } from '../hooks/useAudioOutputDevices';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';

const SETTING_ID = 'laptrace';

/** Garage 61's lap search, unfiltered. */
const GARAGE61_LAPS_URL = 'https://garage61.net/app/laps/';

/**
 * The same search narrowed to one track and car. The ids are Garage 61's own,
 * translated from iRacing's by the bridge — iRacing's ids mean nothing here,
 * which is why an earlier build of this link landed on the wrong combination.
 * The trailing matrix parameters are Garage 61's own filter defaults: all
 * drivers, no lap-time bounds.
 */
export const garage61LapsUrl = ({
  trackId,
  carId,
}: Garage61SearchInfo): string =>
  `https://garage61.net/app/laps/${trackId}/${carId};a=-1;bw=0,;bp=,0`;

type Garage61Status =
  | {
      kind: 'success';
      label: string;
      lapTimeSec: number;
      driver?: string;
      car?: string;
      track?: string;
    }
  | { kind: 'error'; message: string }
  | null;

type IbtStatus =
  | {
      kind: 'success';
      label: string;
      lapTimeSec: number;
      fileName: string;
      driver?: string;
      car?: string;
      track?: string;
    }
  | { kind: 'error'; message: string }
  | null;

/** Format seconds as M:SS.mmm for the imported-lap readout. */
const formatLapTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds - minutes * 60).toFixed(3).padStart(6, '0');
  return `${minutes}:${rest}`;
};

const defaultConfig = getWidgetDefaultConfig('laptrace');

const LAST_CORNER_DISPLAY_ORDER = [
  'corner',
  'cornerTimeDelta',
  'brakePointDelta',
  'apexSpeedDelta',
] as const;

const LAST_CORNER_DISPLAY_LABELS = {
  corner: 'Corner Label',
  cornerTimeDelta: 'Corner Time Delta',
  brakePointDelta: 'Brake Point Delta',
  apexSpeedDelta: 'Min Speed Delta',
} as const;

type LastCornerDisplayColumn = (typeof LAST_CORNER_DISPLAY_ORDER)[number];

const normalizeLastCornerDisplayOrder = (
  order: readonly string[] | undefined
): LastCornerDisplayColumn[] => [
  ...(order ?? []).filter(
    (column, index, values): column is LastCornerDisplayColumn =>
      LAST_CORNER_DISPLAY_ORDER.includes(column as LastCornerDisplayColumn) &&
      values.indexOf(column) === index
  ),
  ...LAST_CORNER_DISPLAY_ORDER.filter(
    (column) => !(order ?? []).includes(column)
  ),
];

/** A compact labelled colour swatch, two of which sit per row in the grid. */
const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex items-center gap-2 text-xs text-slate-400">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-6 w-8 flex-none rounded bg-slate-700 cursor-pointer"
    />
    <span className="truncate">{label}</span>
  </label>
);

/**
 * The editable plot colours, in display order (two per row). 'car line' is
 * not one of the LapTraceColors — it is its own top-level config field — so
 * each entry says which handler it feeds instead of assuming a colours key.
 */
type ColorFieldSpec =
  | { kind: 'color'; key: keyof LapTraceColors; label: string }
  | { kind: 'carLine'; label: string };

const COLOR_FIELDS: ColorFieldSpec[] = [
  { kind: 'color', key: 'referenceThrottle', label: 'Ref Throttle' },
  { kind: 'color', key: 'ghostThrottle', label: 'Throttle' },
  { kind: 'color', key: 'referenceBrake', label: 'Ref Brake' },
  { kind: 'color', key: 'ghostBrake', label: 'Brake' },
  { kind: 'color', key: 'referenceSpeed', label: 'Ref Speed' },
  { kind: 'color', key: 'ghostSpeed', label: 'Speed' },
  { kind: 'color', key: 'referenceThrottleFill', label: 'Throttle fill' },
  { kind: 'color', key: 'referenceBrakeFill', label: 'Brake fill' },
  { kind: 'color', key: 'abs', label: 'ABS' },
  { kind: 'color', key: 'absFill', label: 'ABS fill' },
  { kind: 'color', key: 'throttleMarker', label: 'Throttle marker' },
  { kind: 'color', key: 'brakeMarker', label: 'Brake marker' },
  { kind: 'carLine', label: 'Car line' },
  { kind: 'color', key: 'grid', label: 'Grid line' },
];

/** The four countdown tones, in play order. */
const SOUND_CUES: { key: BrakeCueSound; label: string }[] = [
  { key: 'count3', label: 'Sound at 3 seconds' },
  { key: 'count2', label: 'Sound at 2 seconds' },
  { key: 'count1', label: 'Sound at 1 seconds' },
  { key: 'brake', label: 'Sound at brake point' },
];

const OSCILLATOR_TYPES: { label: string; value: OscillatorType }[] = [
  { label: 'Sine', value: 'sine' },
  { label: 'Triangle', value: 'triangle' },
  { label: 'Square', value: 'square' },
  { label: 'Sawtooth', value: 'sawtooth' },
];

export const LapTraceSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as LapTraceWidgetSettings | undefined;

  const [settings, setSettings] = useState<LapTraceWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as LapTraceWidgetSettings['config']) ??
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('lapTraceTab') as SettingsTabType) || 'trace'
  );

  useEffect(() => {
    localStorage.setItem('lapTraceTab', activeTab);
  }, [activeTab]);

  const [garage61Status, setGarage61Status] = useState<Garage61Status>(null);
  const [ibtStatus, setIbtStatus] = useState<IbtStatus>(null);
  const [ibtImporting, setIbtImporting] = useState(false);
  const [confirmingResetBest, setConfirmingResetBest] = useState(false);
  const [bestLapInfo, setBestLapInfo] = useState<LapTraceBestInfo | null>(null);
  // Null until a session names a track and car that both appear in the
  // bundled id table; the link falls back to the unfiltered search until then.
  const [garage61SearchInfo, setGarage61SearchInfo] =
    useState<Garage61SearchInfo | null>(null);

  // Settings has no live session of its own, so it polls main for the current
  // track/car and whether a best is stored — enough to label and enable the
  // reset control. Session info changes rarely, so a slow poll is plenty.
  useEffect(() => {
    const bridge = window.lapTraceBridge;
    if (!bridge?.getCurrentBestLapInfo) return;
    let cancelled = false;
    const refresh = () => {
      bridge
        .getCurrentBestLapInfo()
        .then((info) => {
          if (!cancelled) setBestLapInfo(info);
        })
        .catch(() => {
          if (!cancelled) setBestLapInfo(null);
        });
      bridge
        .getGarage61SearchInfo()
        .then((info) => {
          if (!cancelled) setGarage61SearchInfo(info);
        })
        .catch(() => {
          if (!cancelled) setGarage61SearchInfo(null);
        });
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Only enumerated once the countdown is switched on: enumerateDevices() is a
  // permission-gated system call, so a user who never wants cues never makes it.
  const audioOutputDevices = useAudioOutputDevices(
    !!settings.config.brakeCueAudio
  );
  const selectedAudioDeviceId =
    settings.config.brakeCueOutputDeviceId ?? DEFAULT_AUDIO_OUTPUT_DEVICE_ID;

  // Settings is its own renderer with its own audio context, so it has to be
  // routed too — otherwise "Test sound" would prove the tones but not the
  // device the user just picked.
  useEffect(() => {
    setBrakeCueOutputDevice(selectedAudioDeviceId);
  }, [selectedAudioDeviceId]);

  // Top and bottom place the panel across the width, where it is only as tall
  // as its own lines and so can never show more than the corner just finished.
  const isLastCornerHorizontal =
    (settings.config.lastCornerPosition ?? 'left') === 'top' ||
    (settings.config.lastCornerPosition ?? 'left') === 'bottom';

  const audioDeviceOptions = useMemo(() => {
    const options = [
      { label: 'Default (Windows)', value: DEFAULT_AUDIO_OUTPUT_DEVICE_ID },
      ...audioOutputDevices.map((device) => ({
        label: device.label,
        value: device.deviceId,
      })),
    ];
    // A headset chosen earlier and since unplugged still has to appear, or the
    // picker would read "Default" while the saved config says otherwise.
    if (!options.some((option) => option.value === selectedAudioDeviceId)) {
      options.push({
        label: 'Selected device (not connected)',
        value: selectedAudioDeviceId,
      });
    }
    return options;
  }, [audioOutputDevices, selectedAudioDeviceId]);

  const testCueTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      for (const timer of testCueTimers.current) clearTimeout(timer);
    },
    []
  );

  /**
   * Plays the four cues a second apart at the configured volume. The click is a
   * real user gesture, so this always sounds here — it proves the tones and the
   * volume, not the overlay's own audio path, which is a separate renderer.
   */
  const playTestCues = () => {
    const volume = settings.config.brakeCueVolume ?? 0.6;
    const cues = settings.config.sound ?? DEFAULT_LAP_TRACE_SOUND;
    playBrakeCue('count3', volume, cues);
    testCueTimers.current.push(
      setTimeout(() => playBrakeCue('count2', volume, cues), 1000),
      setTimeout(() => playBrakeCue('count1', volume, cues), 2000),
      setTimeout(() => playBrakeCue('brake', volume, cues), 3000)
    );
  };

  useEffect(() => {
    const bridge = window.lapTraceBridge;
    if (!bridge) return;
    bridge
      .getLapTrace(
        GARAGE61_IMPORT_TRACK_ID,
        GARAGE61_IMPORT_CAR_PATH,
        'garage61'
      )
      .then((record) => {
        if (record)
          setGarage61Status({
            kind: 'success',
            label: record.source.label,
            lapTimeSec: record.lapTimeSec,
            driver: record.source.driver,
            car: record.source.car,
            track: record.source.track,
          });
      })
      .catch(() => {
        // Best-effort — this only seeds the "currently imported" display.
      });
  }, []);

  const handleImportGarage61 = async () => {
    const bridge = window.lapTraceBridge;
    if (!bridge) return;
    const result = await useLapTraceStore.getState().importGarage61Lap(bridge);
    if (result.ok === 'cancelled') return;
    setGarage61Status(
      result.ok
        ? {
            kind: 'success',
            label: result.label,
            lapTimeSec: result.lapTimeSec,
            driver: result.driver,
            car: result.car,
            track: result.track,
          }
        : { kind: 'error', message: result.error }
    );
  };

  const handleImportIbt = async () => {
    const bridge = window.lapTraceBridge;
    if (!bridge) return;
    setIbtImporting(true);
    try {
      const result = await useLapTraceStore.getState().importIbtLap(bridge);
      if (result.ok === 'cancelled') return;
      setIbtStatus(
        result.ok
          ? {
              kind: 'success',
              label: result.label,
              lapTimeSec: result.lapTimeSec,
              fileName: result.fileName,
              driver: result.driver,
              car: result.car,
              track: result.track,
            }
          : { kind: 'error', message: result.error }
      );
    } finally {
      setIbtImporting(false);
    }
  };

  const handleClearGarage61 = async () => {
    const bridge = window.lapTraceBridge;
    if (!bridge) return;
    await useLapTraceStore.getState().discardImportedLap(bridge, 'garage61');
    setGarage61Status(null);
  };

  const handleClearIbt = async () => {
    const bridge = window.lapTraceBridge;
    if (!bridge) return;
    await useLapTraceStore.getState().discardImportedLap(bridge, 'manual');
    setIbtStatus(null);
  };

  const handleResetBestLap = () => {
    // The overlay window owns the live track/car, so it does the actual clear
    // and threshold reset; here we just ask every window to do so.
    window.lapTraceBridge?.requestClearBestLap?.();
    setConfirmingResetBest(false);
    // Reflect the deletion right away; the next poll re-confirms from disk.
    setBestLapInfo((info) => (info ? { ...info, hasBest: false } : info));
  };

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Lap Trace"
      description="Plots a saved lap's throttle, brake and speed against position on track, in a window that slides with your car, drawn pastel as a background target. Your current lap is drawn over it as a bright ghost so you can see where the reference brakes and gets back on power."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="trace"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Trace
            </TabButton>
            <TabButton
              id="corner"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Corner
            </TabButton>
            <TabButton
              id="braking"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Braking
            </TabButton>
            <TabButton
              id="styling"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Styling
            </TabButton>
            <TabButton
              id="visibility"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Visibility
            </TabButton>
            <TabButton
              id="help"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Help
            </TabButton>
          </div>

          <div>
            {activeTab === 'trace' && (
              <SettingsSection title="Reference Lap">
                <SettingSelectRow
                  title="Reference Source"
                  description="Which saved lap to plot. Your personal best is recorded automatically from your first clean lap on each track and car."
                  value={settings.config.referenceSource}
                  options={[
                    { label: 'My best lap', value: 'best' },
                    {
                      label: 'Imported .ibt lap',
                      value: 'manual',
                    },
                    {
                      label: 'Garage 61 (imported lap)',
                      value: 'garage61',
                    },
                  ]}
                  onChange={(v) => handleConfigChange({ referenceSource: v })}
                />

                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    {!bestLapInfo
                      ? 'Start driving to manage the best lap for the current track and car.'
                      : !bestLapInfo.hasBest
                        ? `No best lap recorded yet for ${bestLapInfo.trackName} — ${bestLapInfo.carName}.`
                        : confirmingResetBest
                          ? `Delete your best lap for ${bestLapInfo.trackName} — ${bestLapInfo.carName}? This cannot be undone.`
                          : 'Reset your recorded best lap for the track and car you are driving now. The next clean lap becomes the new best.'}
                  </p>
                  <div className="flex items-center gap-2 flex-none">
                    {confirmingResetBest && bestLapInfo?.hasBest ? (
                      <>
                        <button
                          type="button"
                          onClick={handleResetBestLap}
                          className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingResetBest(false)}
                          className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={!bestLapInfo?.hasBest}
                        onClick={() => setConfirmingResetBest(true)}
                        className="text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded px-2 py-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-slate-300"
                      >
                        Reset my best lap
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      Import a lap exported from Garage 61 as a CSV file to use
                      as the reference.
                    </p>
                    {garage61Status?.kind === 'success' && (
                      <div className="text-xs text-emerald-400 mt-1 space-y-0.5">
                        <p className="font-semibold text-slate-300">
                          Imported:
                        </p>
                        <p>
                          <span className="text-slate-400">Lap Time:</span>{' '}
                          {formatLapTime(garage61Status.lapTimeSec)}
                        </p>
                        {garage61Status.driver && (
                          <p>
                            <span className="text-slate-400">Driver:</span>{' '}
                            {garage61Status.driver}
                          </p>
                        )}
                        {garage61Status.car && (
                          <p>
                            <span className="text-slate-400">Car:</span>{' '}
                            {garage61Status.car}
                          </p>
                        )}
                        {garage61Status.track && (
                          <p>
                            <span className="text-slate-400">Track:</span>{' '}
                            {garage61Status.track}
                          </p>
                        )}
                        {!garage61Status.driver &&
                          !garage61Status.car &&
                          !garage61Status.track && (
                            <p>{garage61Status.label}</p>
                          )}
                      </div>
                    )}
                    {garage61Status?.kind === 'error' && (
                      <p className="text-xs text-red-400 mt-1">
                        {garage61Status.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <a
                      href={
                        garage61SearchInfo
                          ? garage61LapsUrl(garage61SearchInfo)
                          : GARAGE61_LAPS_URL
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded px-2 py-1 transition-colors cursor-pointer"
                    >
                      <ArrowSquareOutIcon size={13} />
                      Find laps on Garage 61
                    </a>
                    {garage61Status?.kind === 'success' && (
                      <button
                        type="button"
                        onClick={handleClearGarage61}
                        className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleImportGarage61}
                      className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded px-2 py-1 transition-colors cursor-pointer"
                    >
                      <UploadSimpleIcon size={13} />
                      Import Garage 61 Lap
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      Import a saved iRacing .ibt telemetry file. Only the
                      fastest clean lap in the file is kept, matched to that
                      lap&apos;s own track and car.
                    </p>
                    {ibtStatus?.kind === 'success' && (
                      <div className="text-xs text-emerald-400 mt-1 space-y-0.5">
                        <p className="font-semibold text-slate-300">
                          Imported:
                        </p>
                        <p>
                          <span className="text-slate-400">Lap Time:</span>{' '}
                          {formatLapTime(ibtStatus.lapTimeSec)}
                        </p>
                        {ibtStatus.driver && (
                          <p>
                            <span className="text-slate-400">Driver:</span>{' '}
                            {ibtStatus.driver}
                          </p>
                        )}
                        {ibtStatus.car && (
                          <p>
                            <span className="text-slate-400">Car:</span>{' '}
                            {ibtStatus.car}
                          </p>
                        )}
                        {ibtStatus.track && (
                          <p>
                            <span className="text-slate-400">Track:</span>{' '}
                            {ibtStatus.track}
                          </p>
                        )}
                        <p className="text-slate-500">{ibtStatus.fileName}</p>
                      </div>
                    )}
                    {ibtStatus?.kind === 'error' && (
                      <p className="text-xs text-red-400 mt-1">
                        {ibtStatus.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    {ibtStatus?.kind === 'success' && (
                      <button
                        type="button"
                        onClick={handleClearIbt}
                        className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleImportIbt}
                      disabled={ibtImporting}
                      className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded px-2 py-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
                    >
                      <UploadSimpleIcon size={13} />
                      {ibtImporting ? 'Importing…' : 'Import .ibt Lap'}
                    </button>
                  </div>
                </div>

                <SettingSliderRow
                  title="Distance Behind"
                  description="How much track behind the car is visible"
                  value={settings.config.metersBehind}
                  units="m"
                  min={50}
                  max={MAX_METERS_BEHIND}
                  step={50}
                  onChange={(v) => handleConfigChange({ metersBehind: v })}
                />

                <SettingSliderRow
                  title="Distance Ahead"
                  description="How much track ahead of the car is visible. Set this and Distance Behind unevenly to see further in one direction than the other."
                  value={settings.config.metersAhead}
                  units="m"
                  min={50}
                  max={600}
                  step={50}
                  onChange={(v) => handleConfigChange({ metersAhead: v })}
                />
              </SettingsSection>
            )}

            {activeTab === 'trace' && (
              <SettingsSection title="Channels">
                <SettingToggleRow
                  title="Throttle"
                  description="Plot the throttle trace"
                  enabled={settings.config.showThrottle}
                  onToggle={(v) => handleConfigChange({ showThrottle: v })}
                />

                <SettingToggleRow
                  title="Brake"
                  description="Plot the brake trace"
                  enabled={settings.config.showBrake}
                  onToggle={(v) => handleConfigChange({ showBrake: v })}
                />

                <SettingToggleRow
                  title="Speed"
                  description="Plot speed, scaled to the reference lap's own range"
                  enabled={settings.config.showSpeed}
                  onToggle={(v) => handleConfigChange({ showSpeed: v })}
                />

                <SettingToggleRow
                  title="Gear Labels"
                  description="Show the gear number at each shift point in the reference lap"
                  enabled={settings.config.showGearLabels}
                  onToggle={(v) => handleConfigChange({ showGearLabels: v })}
                />

                <SettingToggleRow
                  title="Brake Points"
                  description="A dotted vertical line through the plot at the exact point the reference (and, while you're driving, your own lap) applied and released the brake. Interpolated between telemetry samples, so it's accurate to well under a metre — finer than the trace itself can be."
                  enabled={settings.config.showBrakePointMarkers}
                  onToggle={(v) =>
                    handleConfigChange({ showBrakePointMarkers: v })
                  }
                />

                <SettingToggleRow
                  title="Throttle Points"
                  description="A dotted vertical line through the plot at the exact point the reference got back on the throttle."
                  enabled={settings.config.showThrottlePointMarkers}
                  onToggle={(v) =>
                    handleConfigChange({ showThrottlePointMarkers: v })
                  }
                />

                <SettingToggleRow
                  title="Input Trace"
                  description="Overlay the lap you are driving now, bright, on the same axes"
                  enabled={settings.config.showGhost}
                  onToggle={(v) => handleConfigChange({ showGhost: v })}
                />

                <SettingToggleRow
                  title="ABS"
                  description="Colour your brake trace where ABS took over, the same yellow the Input widget uses"
                  enabled={settings.config.showAbs ?? true}
                  onToggle={(v) => handleConfigChange({ showAbs: v })}
                />

                {(settings.config.showAbs ?? true) && (
                  <SettingSelectRow<'overlay' | 'bar'>
                    title="ABS Style"
                    description="'Bar' fills your brake trace down to the axis where ABS engaged, the same as the Input Trace widget, and blends colour with a filled reference trace it overlaps. 'Overlay' just colours the line."
                    value={settings.config.absStyle ?? 'bar'}
                    options={[
                      { label: 'Bar (fill under curve)', value: 'bar' },
                      { label: 'Overlay', value: 'overlay' },
                    ]}
                    onChange={(v) => handleConfigChange({ absStyle: v })}
                  />
                )}

                {(settings.config.showAbs ?? true) && (
                  <SettingToggleRow
                    title="ABS Strip"
                    description="Also mark where ABS engaged as a bar beneath the traces, easier to spot than the trace colour alone"
                    enabled={settings.config.showAbsBar ?? false}
                    onToggle={(v) => handleConfigChange({ showAbsBar: v })}
                  />
                )}

                <SettingToggleRow
                  title="Fill Reference Under Curve"
                  description="Draw the reference throttle and brake as filled bars down to the axis instead of a line"
                  enabled={settings.config.referenceFilled ?? true}
                  onToggle={(v) => handleConfigChange({ referenceFilled: v })}
                />
              </SettingsSection>
            )}

            {activeTab === 'corner' && (
              <SettingsSection title="Last Corner">
                <SettingToggleRow
                  title="Last Corner Panel"
                  description="Shows how the corners you just finished compared with the reference lap. Each result appears as you exit the corner and stays while the next few are driven, so a sequence of corners is still readable afterwards. The corner you are in holds an empty slot until you exit it. Needs the bundled track data for the circuit."
                  enabled={settings.config.showLastCorner}
                  onToggle={(v) => handleConfigChange({ showLastCorner: v })}
                />

                {settings.config.showLastCorner && (
                  <>
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-slate-200">
                        Corner History Column Order
                      </h3>
                      <p className="mt-1 mb-3 text-xs text-slate-400">
                        Drag columns to choose their left-to-right order. Empty
                        delta cells keep their column so history stays aligned.
                      </p>
                      <SortableList
                        items={normalizeLastCornerDisplayOrder(
                          settings.config.lastCornerDisplayOrder
                        ).map((id) => ({
                          id,
                          label: LAST_CORNER_DISPLAY_LABELS[id],
                        }))}
                        onReorder={(items) =>
                          handleConfigChange({
                            lastCornerDisplayOrder: items.map(
                              (item) => item.id
                            ),
                          })
                        }
                        renderItem={(item, sortableProps) => (
                          <DraggableSettingItem
                            key={item.id}
                            label={item.label}
                            enabled={
                              item.id === 'corner' ||
                              (item.id === 'cornerTimeDelta' &&
                                settings.config.showLastCornerTime) ||
                              (item.id === 'brakePointDelta' &&
                                settings.config.showLastCornerBrakeDelta) ||
                              (item.id === 'apexSpeedDelta' &&
                                settings.config.showLastCornerApexSpeed)
                            }
                            showToggle={item.id !== 'corner'}
                            onToggle={(enabled) => {
                              if (item.id === 'corner') return;
                              if (item.id === 'cornerTimeDelta') {
                                handleConfigChange({
                                  showLastCornerTime: enabled,
                                });
                              } else if (item.id === 'brakePointDelta') {
                                handleConfigChange({
                                  showLastCornerBrakeDelta: enabled,
                                });
                              } else {
                                handleConfigChange({
                                  showLastCornerApexSpeed: enabled,
                                });
                              }
                            }}
                            sortableProps={sortableProps}
                          />
                        )}
                      />
                    </div>

                    <SettingSelectRow
                      title="Corner Label"
                      description="Name uses the track's own corner names and wraps a long one over two lines. Turn number shows T1, T2 and so on instead, which keeps the rows compact; where a complex is split into several sections both styles letter them A, B, C."
                      value={settings.config.lastCornerLabelStyle ?? 'name'}
                      options={[
                        { label: 'Name', value: 'name' },
                        { label: 'Turn number', value: 'number' },
                      ]}
                      onChange={(v) =>
                        handleConfigChange({ lastCornerLabelStyle: v })
                      }
                    />

                    <SettingSelectRow
                      title="Min Speed Unit"
                      value={settings.config.lastCornerSpeedUnit}
                      options={[
                        { label: 'Auto (follow iRacing)', value: 'auto' },
                        { label: 'km/h', value: 'km/h' },
                        { label: 'mph', value: 'mph' },
                      ]}
                      onChange={(v) =>
                        handleConfigChange({ lastCornerSpeedUnit: v })
                      }
                    />

                    <SettingSelectRow
                      title="Panel Position"
                      description="Which edge of the graph the panel sits on. Left and right stack the corners in a column and take width from the trace, so they suit a wider widget."
                      value={settings.config.lastCornerPosition ?? 'left'}
                      options={[
                        { label: 'Bottom', value: 'bottom' },
                        { label: 'Top', value: 'top' },
                        { label: 'Left', value: 'left' },
                        { label: 'Right', value: 'right' },
                      ]}
                      onChange={(v) =>
                        handleConfigChange({ lastCornerPosition: v })
                      }
                    />

                    {/* Above or below the trace the panel is only as tall as
                        its own lines, so there is never room for history —
                        only the corner just finished shows, whatever this is
                        set to. Hidden rather than disabled: a control that
                        changes nothing is worse than one that is not there. */}
                    {!isLastCornerHorizontal && (
                      <SettingSliderRow
                        title="Corners Shown"
                        description="How many recent corners stay on screen. Through esses and chicanes the next corner often starts within a second, so more than one keeps a sequence readable."
                        value={settings.config.lastCornerCount ?? 3}
                        min={1}
                        max={5}
                        step={1}
                        onChange={(v) =>
                          handleConfigChange({ lastCornerCount: v })
                        }
                      />
                    )}
                  </>
                )}
              </SettingsSection>
            )}

            {activeTab === 'braking' && (
              <SettingsSection title="Brake Point Countdown">
                <SettingToggleRow
                  title="Countdown Bar(s)"
                  description="Display bar(s) that drain before your reference lap braked. Turning red at the brake point itself. Follows the reference lap's brake points; light dabs of the brake are ignored."
                  enabled={settings.config.brakeCueBars}
                  onToggle={(v) => handleConfigChange({ brakeCueBars: v })}
                />

                {settings.config.brakeCueBars &&
                  (() => {
                    const barSide = settings.config.brakeCueBarSide ?? 'right';
                    const isVertical =
                      barSide === 'left' || barSide === 'right';
                    return (
                      <>
                        <SettingButtonGroupRow
                          title="Bar Position"
                          description="Left/Right run a full-height column of 4 bars beside the trace that drain 3, 2 and 1 second before your reference lap braked. Top/Bottom run a single continuous bar across the width instead."
                          value={barSide}
                          options={[
                            { label: 'Left', value: 'left' },
                            { label: 'Right', value: 'right' },
                            { label: 'Top', value: 'top' },
                            { label: 'Bottom', value: 'bottom' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({ brakeCueBarSide: v })
                          }
                        />

                        {isVertical && (
                          <SettingButtonGroupRow
                            title="Final Bar"
                            description="Which end the last bar sits at — the one that turns red at the brake point. The strip drains towards it."
                            value={settings.config.brakeCueLastBar ?? 'top'}
                            options={[
                              { label: 'Top', value: 'top' },
                              { label: 'Bottom', value: 'bottom' },
                            ]}
                            onChange={(v) =>
                              handleConfigChange({ brakeCueLastBar: v })
                            }
                          />
                        )}
                      </>
                    );
                  })()}

                <SettingToggleRow
                  title="Countdown Sound"
                  description="Three beeps at 3, 2 and 1 second, then a distinct tone at the brake point."
                  enabled={settings.config.brakeCueAudio}
                  onToggle={(v) => handleConfigChange({ brakeCueAudio: v })}
                />

                {settings.config.brakeCueAudio &&
                  (() => {
                    const soundCfg =
                      settings.config.sound ?? DEFAULT_LAP_TRACE_SOUND;
                    const updateCue = (
                      key: BrakeCueSound,
                      patch: Partial<LapTraceSoundCue>
                    ) =>
                      handleConfigChange({
                        sound: {
                          ...soundCfg,
                          [key]: { ...soundCfg[key], ...patch },
                        },
                      });
                    return (
                      <>
                        <SettingSelectRow
                          title="Audio Output Device"
                          description="Which Windows playback device the countdown tones use. Default follows whatever Windows is set to."
                          value={selectedAudioDeviceId}
                          options={audioDeviceOptions}
                          onChange={(v) =>
                            handleConfigChange({ brakeCueOutputDeviceId: v })
                          }
                        />

                        <SettingSliderRow
                          title="Cue Volume"
                          description="How loud the countdown tones are"
                          value={Math.round(
                            (settings.config.brakeCueVolume ?? 0.6) * 100
                          )}
                          units="%"
                          min={0}
                          max={100}
                          step={5}
                          onChange={(v) =>
                            handleConfigChange({ brakeCueVolume: v / 100 })
                          }
                        />

                        <SettingSliderRow
                          title="Brake point cue lead"
                          description="Adjusts how many seconds before the braking point the audio alert will trigger. It can be used to compensate for driver reaction time."
                          value={settings.config.brakeCueLeadSec ?? 0}
                          units="s"
                          min={0}
                          max={0.6}
                          step={0.1}
                          onChange={(v) =>
                            handleConfigChange({ brakeCueLeadSec: v })
                          }
                        />

                        {SOUND_CUES.map(({ key, label }) => {
                          const cue = soundCfg[key];
                          return (
                            <div
                              key={key}
                              className="space-y-1 border-t border-slate-700/40 pt-2"
                            >
                              <span className="text-md font-semibold text-slate-300">
                                {label}
                              </span>
                              <SettingSliderRow
                                title="Frequency"
                                value={Math.round(cue.frequency)}
                                units="Hz"
                                min={200}
                                max={2000}
                                step={10}
                                onChange={(v) =>
                                  updateCue(key, { frequency: v })
                                }
                              />
                              <SettingSelectRow<OscillatorType>
                                title="Waveform"
                                value={cue.type}
                                options={OSCILLATOR_TYPES}
                                onChange={(v) => updateCue(key, { type: v })}
                              />
                              <SettingSliderRow
                                title="Duration"
                                value={Math.round(cue.durationSec * 1000)}
                                units="ms"
                                min={20}
                                max={500}
                                step={10}
                                onChange={(v) =>
                                  updateCue(key, { durationSec: v / 1000 })
                                }
                              />
                              <SettingSliderRow
                                title="Level"
                                value={Math.round(cue.peak * 100)}
                                units="%"
                                min={0}
                                max={100}
                                step={5}
                                onChange={(v) =>
                                  updateCue(key, { peak: v / 100 })
                                }
                              />
                            </div>
                          );
                        })}

                        <div className="flex items-center gap-3 border-t border-slate-700/50 pt-2">
                          <SettingActionButton
                            label="Test sound"
                            title="Test Sound"
                            description="Plays the three beeps and the brake tone here in Settings, so you can tune them without being on track."
                            onClick={playTestCues}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleConfigChange({
                                sound: DEFAULT_LAP_TRACE_SOUND,
                              })
                            }
                            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex-none"
                          >
                            Restore default sound
                          </button>
                        </div>
                      </>
                    );
                  })()}
              </SettingsSection>
            )}

            {activeTab === 'styling' && (
              <SettingsSection title="Styling">
                <SettingSliderRow
                  title="Line Thickness"
                  description="Stroke width of the reference traces"
                  value={settings.config.strokeWidth}
                  min={1}
                  max={6}
                  step={1}
                  onChange={(v) => handleConfigChange({ strokeWidth: v })}
                />

                <SettingSliderRow
                  title="Reference Opacity"
                  description="How prominent the saved reference lap is (lines and bars)"
                  value={Math.round((settings.config.ghostOpacity ?? 1) * 100)}
                  units="%"
                  min={10}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({ ghostOpacity: v / 100 })
                  }
                />

                <SettingSliderRow
                  title="Driver Input Opacity"
                  description="How prominent the live driver input trace is"
                  value={Math.round((settings.config.driverOpacity ?? 1) * 100)}
                  units="%"
                  min={10}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({ driverOpacity: v / 100 })
                  }
                />

                <SettingSliderRow
                  title="Background Opacity"
                  description="Background opacity of the overlay"
                  value={Math.round(settings.config.background.opacity * 100)}
                  units="%"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v / 100 } })
                  }
                />

                <div className="space-y-2 border-t border-slate-700/50 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-md font-semibold text-slate-300">
                      Plot Colors
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleConfigChange({
                          colors: DEFAULT_LAP_TRACE_COLORS,
                          carLineColor: '#ffffff',
                        })
                      }
                      className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Restore defaults
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {COLOR_FIELDS.map((field) => {
                      if (field.kind === 'carLine') {
                        return (
                          <ColorField
                            key="carLine"
                            label={field.label}
                            value={settings.config.carLineColor ?? '#ffffff'}
                            onChange={(v) =>
                              handleConfigChange({ carLineColor: v })
                            }
                          />
                        );
                      }
                      const current =
                        settings.config.colors ?? DEFAULT_LAP_TRACE_COLORS;
                      return (
                        <ColorField
                          key={field.key}
                          label={field.label}
                          value={current[field.key]}
                          onChange={(v) =>
                            handleConfigChange({
                              colors: { ...current, [field.key]: v },
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>

                {settings.config.brakeCueBars && (
                  <div className="space-y-2 border-t border-slate-700/50 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-md font-semibold text-slate-300">
                        Countdown Colors
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfigChange({
                            colors: {
                              ...(settings.config.colors ??
                                DEFAULT_LAP_TRACE_COLORS),
                              brakeCueGreen:
                                DEFAULT_LAP_TRACE_COLORS.brakeCueGreen,
                              brakeCueAmber:
                                DEFAULT_LAP_TRACE_COLORS.brakeCueAmber,
                              brakeCueOrange:
                                DEFAULT_LAP_TRACE_COLORS.brakeCueOrange,
                              brakeCueRed: DEFAULT_LAP_TRACE_COLORS.brakeCueRed,
                            },
                          })
                        }
                        className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Restore defaults
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {(() => {
                        const cueColors =
                          settings.config.colors ?? DEFAULT_LAP_TRACE_COLORS;
                        return (
                          <>
                            <ColorField
                              label="Armed (green)"
                              value={cueColors.brakeCueGreen}
                              onChange={(v) =>
                                handleConfigChange({
                                  colors: {
                                    ...cueColors,
                                    brakeCueGreen: v,
                                  },
                                })
                              }
                            />
                            <ColorField
                              label="2 seconds (amber)"
                              value={cueColors.brakeCueAmber}
                              onChange={(v) =>
                                handleConfigChange({
                                  colors: {
                                    ...cueColors,
                                    brakeCueAmber: v,
                                  },
                                })
                              }
                            />
                            <ColorField
                              label="1 second (orange)"
                              value={cueColors.brakeCueOrange}
                              onChange={(v) =>
                                handleConfigChange({
                                  colors: {
                                    ...cueColors,
                                    brakeCueOrange: v,
                                  },
                                })
                              }
                            />
                            <ColorField
                              label="Brake point (red)"
                              value={cueColors.brakeCueRed}
                              onChange={(v) =>
                                handleConfigChange({
                                  colors: {
                                    ...cueColors,
                                    brakeCueRed: v,
                                  },
                                })
                              }
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {settings.config.showLastCorner && (
                  <>
                    <SettingSliderRow
                      title="Last Corner Text Size"
                      description="Size of the corner time and apex speed readout"
                      value={settings.config.lastCornerFontSize ?? 10}
                      units="px"
                      min={8}
                      max={24}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({ lastCornerFontSize: v })
                      }
                    />

                    <SettingSliderRow
                      title="Latest Corner Size"
                      description="How much bigger the corner you just finished is drawn relative to the older ones behind it"
                      value={settings.config.lastCornerLatestScale ?? 1.4}
                      units="×"
                      min={1}
                      max={2.5}
                      step={0.1}
                      onChange={(v) =>
                        handleConfigChange({ lastCornerLatestScale: v })
                      }
                    />
                  </>
                )}
              </SettingsSection>
            )}

            {/* VISIBILITY TAB */}
            {activeTab === 'visibility' && (
              <SettingsSection title="Session Visibility">
                <SessionVisibility
                  sessionVisibility={settings.config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />

                <SettingDivider />

                <SettingToggleRow
                  title="Show only when on track"
                  description="If enabled, inputs will only be shown when driving"
                  enabled={settings.config.showOnlyWhenOnTrack ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showOnlyWhenOnTrack: newValue })
                  }
                />
              </SettingsSection>
            )}

            {activeTab === 'help' && <LapTraceHelp />}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
