import { ReleaseNotesSettings } from './ReleaseNotes/ReleaseNotesSettings';
import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import type { WidgetId } from '@irdashies/types';
import { StandingsSettings } from './sections/StandingsSettings';
import { RelativeSettings } from './sections/RelativeSettings';
import { WeatherSettings } from './sections/WeatherSettings';
import { WindSettings } from './sections/WindSettings';
import { TrackMapSettings } from './sections/TrackMapSettings';
import { FlatTrackMapSettings } from './sections/FlatTrackMapSettings';
import { AdvancedSettings } from './sections/AdvancedSettings';
import { InputSettings } from './sections/InputSettings';
import { TachometerSettings } from './sections/TachometerSettings';
import { ShiftLightSettings } from './sections/ShiftLightSettings';
import { AboutSettings } from './sections/AboutSettings';
import { FasterCarsFromBehindSettings } from './sections/FasterCarsFromBehindSettings';
import { FuelSettings } from './sections/FuelSettings';
import { RejoinIndicatorSettings } from './sections/RejoinIndicatorSettings';
import { PitlaneHelperSettings } from './sections/PitlaneHelperSettings';
import { GeneralSettings } from './sections/GeneralSettings';
import { BlindSpotMonitorSettings } from './sections/BlindSpotMonitorSettings';
import { RadarSettings } from './sections/RadarSettings';
import { GarageCoverSettings } from './sections/GarageCoverSettings';
import { ProfileSettings } from './sections/ProfileSettings';
import { FlagSettings } from './sections/FlagSettings';
import { CarSetupSettings } from './sections/CarSetupSettings';
import { TwitchChatSettings } from './sections/TwitchChatSettings';
import { DriverTagsSettings } from './sections/DriverTagsSettings';
import { KeybindingsSettings } from './sections/KeybindingsSettings';
import { LapTimeLogSettings } from './sections/LapTimeLogSettings';
import { InformationBarSettings } from './sections/InformationBarSettings';
import { useDashboard } from '@irdashies/context';
import { SlowCarAheadSettings } from './sections/SlowCarAheadSettings';
import { SectorDeltaSettings } from './sections/SectorDeltaSettings';
import { DeltaSpeedSettings } from './sections/DeltaSpeedSettings';
import { CarSystemsSettings } from './sections/CarSystemsSettings';
import { HeartRateSettings } from './sections/HeartRateSettings';
import { CornerNameSettings } from './sections/CornerNameSettings';
import { LapTraceSettings } from './sections/LapTraceSettings';
import { BattleSettings } from './sections/BattleSettings';
import { BroadcastSettingsPage } from './sections/BroadcastGroupSettings';
import { GantrySettings } from './sections/GantrySettings';

/**
 * Settings page per widget type. Telemetry Inspector has none of its own: its
 * settings live on the Advanced page.
 */
export const WIDGET_SETTINGS: Record<
  Exclude<WidgetId, 'telemetryinspector'>,
  ComponentType<{ widgetId?: string; widgetType?: string }>
> = {
  standings: StandingsSettings,
  relative: RelativeSettings,
  weather: WeatherSettings,
  wind: WindSettings,
  fuel: FuelSettings,
  map: TrackMapSettings,
  flatmap: FlatTrackMapSettings,
  input: InputSettings,
  tachometer: TachometerSettings,
  shiftlight: ShiftLightSettings,
  pitlanehelper: PitlaneHelperSettings,
  rejoin: RejoinIndicatorSettings,
  fastercarsfrombehind: FasterCarsFromBehindSettings,
  blindspotmonitor: BlindSpotMonitorSettings,
  radar: RadarSettings,
  garagecover: GarageCoverSettings,
  flag: FlagSettings,
  twitchchat: TwitchChatSettings,
  laptimelog: LapTimeLogSettings,
  infobar: InformationBarSettings,
  slowcarahead: SlowCarAheadSettings,
  sectordelta: SectorDeltaSettings,
  deltaspeed: DeltaSpeedSettings,
  carsystems: CarSystemsSettings,
  heartrate: HeartRateSettings,
  cornername: CornerNameSettings,
  laptrace: LapTraceSettings,
  battle: BattleSettings,
  // The broadcast widgets share one page, with a tab per widget.
  broadcast: BroadcastSettingsPage,
  broadcastticker: BroadcastSettingsPage,
  broadcastevents: BroadcastSettingsPage,
  broadcastweather: BroadcastSettingsPage,
  broadcastpodium: BroadcastSettingsPage,
  gantry: GantrySettings,
};

interface SettingsLoaderProps {
  previewMode?: boolean;
}

export const SettingsLoader = ({ previewMode }: SettingsLoaderProps = {}) => {
  const { widgetId } = useParams<{ widgetId: string }>();
  const { currentDashboard } = useDashboard();

  // 1. Handle non-widget pages
  if (widgetId === 'general')
    return <GeneralSettings previewMode={previewMode} />;
  if (widgetId === 'profiles') return <ProfileSettings />;
  if (widgetId === 'advanced') return <AdvancedSettings />;
  if (widgetId === 'car-setup') return <CarSetupSettings />;
  if (widgetId === 'about') return <AboutSettings />;
  if (widgetId === 'release-notes') return <ReleaseNotesSettings />;
  if (widgetId === 'driver-tags') return <DriverTagsSettings />;
  if (widgetId === 'keybindings') return <KeybindingsSettings />;

  // 2. Find specific widget instance (may be undefined if widgetId is a type name)
  const widget = currentDashboard?.widgets.find((w) => w.id === widgetId);
  const type = widget ? widget.type || widget.id : widgetId;

  const Settings = Object.hasOwn(WIDGET_SETTINGS, type ?? '')
    ? WIDGET_SETTINGS[type as keyof typeof WIDGET_SETTINGS]
    : undefined;
  if (Settings) return <Settings widgetId={widget?.id} widgetType={type} />;

  return widget ? (
    <div className="text-red-400">No settings available for {type}</div>
  ) : (
    <div className="text-slate-400">Select a widget to edit</div>
  );
};
