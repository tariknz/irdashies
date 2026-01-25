import { Standings } from './components/Standings/Standings';
import { Input } from './components/Input';
import { Relative } from './components/Standings/Relative';
import { TrackMap } from './components/TrackMap/TrackMap';
import { FlatTrackMap } from './components/TrackMap/FlatTrackMap';
import { Weather } from './components/Weather';
import { FasterCarsFromBehind } from './components/FasterCarsFromBehind/FasterCarsFromBehind';
import { FuelCalculator } from './components/FuelCalculator';
import { BlindSpotMonitor } from './components/BlindSpotMonitor/BlindSpotMonitor';
import { GarageCover } from './components/GarageCover/GarageCover';
import { RejoinIndicator } from './components/RejoinIndicator/RejoinIndicator';
import { TelemetryInspector } from './components/TelemetryInspector/TelemetryInspector';
import { PitlaneHelper } from './components/PitlaneHelper/PitlaneHelper';
import { Tachometer } from './components/Tachometer/Tachometer';

// TODO: type this better, right now the config comes from settings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WIDGET_MAP: Record<string, (config?: any) => React.JSX.Element | null> = {
  standings: Standings,
  input: Input,
  relative: Relative,
  map: TrackMap,
  flatmap: FlatTrackMap,
  weather: Weather,
  fastercarsfrombehind: FasterCarsFromBehind,
  fuel: FuelCalculator,
  blindspotmonitor: BlindSpotMonitor,
  garagecover: GarageCover,
  rejoin: RejoinIndicator,
  telemetryinspector: TelemetryInspector,
  pitlanehelper: PitlaneHelper,
  tachometer: Tachometer,
};

export type WidgetId = keyof typeof WIDGET_MAP;
