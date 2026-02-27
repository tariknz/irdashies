import { useParams } from 'react-router-dom';
import { StandingsSettings } from './sections/StandingsSettings';
import { RelativeSettings } from './sections/RelativeSettings';
import { WeatherSettings } from './sections/WeatherSettings';
import { TrackMapSettings } from './sections/TrackMapSettings';
import { FlatTrackMapSettings } from './sections/FlatTrackMapSettings';
import { AdvancedSettings } from './sections/AdvancedSettings';
import { InputSettings } from './sections/InputSettings';
import { AboutSettings } from './sections/AboutSettings';
import { FasterCarsFromBehindSettings } from './sections/FasterCarsFromBehindSettings';
import { FuelSettings } from './sections/FuelSettings';
import { RejoinIndicatorSettings } from './sections/RejoinIndicatorSettings';
import { PitlaneHelperSettings } from './sections/PitlaneHelperSettings';
import { GeneralSettings } from './sections/GeneralSettings';
import { BlindSpotMonitorSettings } from './sections/BlindSpotMonitorSettings';
import { GarageCoverSettings } from './sections/GarageCoverSettings';
import { ProfileSettings } from './sections/ProfileSettings';
import { FlagSettings } from './sections/FlagSettings';
import { CarSetupSettings } from './sections/CarSetupSettings';
import { TwitchChatSettings } from './sections/TwitchChatSettings';
import { useDashboard } from '@irdashies/context';

export const SettingsLoader = () => {
  const { widgetId } = useParams<{ widgetId: string }>();
  const { currentDashboard } = useDashboard();

  // 1. Handle non-widget pages
  if (widgetId === 'general') return <GeneralSettings />;
  if (widgetId === 'profiles') return <ProfileSettings />;
  if (widgetId === 'advanced') return <AdvancedSettings />;
  if (widgetId === 'car-setup') return <CarSetupSettings />;
  if (widgetId === 'about') return <AboutSettings />;

  // 2. Find specific widget instance (may be undefined if widgetId is a type name)
  const widget = currentDashboard?.widgets.find((w) => w.id === widgetId);
  const type = widget ? widget.type || widget.id : widgetId;

  switch (type) {
    case 'standings':
      return <StandingsSettings />;
    case 'relative':
      return <RelativeSettings />;
    case 'weather':
      return <WeatherSettings />;
    case 'fuel':
      return <FuelSettings widgetId={widget?.id} />;
    case 'map':
      return <TrackMapSettings />;
    case 'flatmap':
      return <FlatTrackMapSettings />;
    case 'input':
      return <InputSettings />;
    case 'pitlanehelper':
      return <PitlaneHelperSettings />;
    case 'rejoin':
      return <RejoinIndicatorSettings />;
    case 'fastercarsfrombehind':
      return <FasterCarsFromBehindSettings />;
    case 'blindspotmonitor':
      return <BlindSpotMonitorSettings />;
    case 'garagecover':
      return <GarageCoverSettings />;
    case 'flag':
      return <FlagSettings />;
    case 'twitchchat':
      return <TwitchChatSettings />;
    default:
      return widget ? (
        <div className="text-red-400">No settings available for {type}</div>
      ) : (
        <div className="text-slate-400">Select a widget to edit</div>
      );
  }
};
