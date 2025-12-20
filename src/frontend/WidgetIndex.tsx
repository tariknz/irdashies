import { Standings } from './components/Standings/Standings';
import { Input } from './components/Input';
import { Relative } from './components/Standings/Relative';
import { TrackMap } from './components/TrackMap/TrackMap';
import { Weather } from './components/Weather';
import { FasterCarsFromBehind } from './components/FasterCarsFromBehind/FasterCarsFromBehind';
import { FuelCalculator } from './components/FuelCalculator';
import { BlindSpotMonitor } from './components/BlindSpotMonitor/BlindSpotMonitor';

// TODO: type this better, right now the config comes from settings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WIDGET_MAP: Record<string, (config: any) => React.JSX.Element> = {
  standings: Standings,
  input: Input,
  relative: Relative,
  map: TrackMap,
  weather: Weather,
  fastercarsfrombehind: FasterCarsFromBehind,
  fuel: FuelCalculator,
  blindspotmonitor: BlindSpotMonitor,
};