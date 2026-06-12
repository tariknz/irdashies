import { Standings } from './components/Standings/Standings';
import { Input } from './components/Input';
import { Relative } from './components/Standings/Relative';
import { TrackMap } from './components/TrackMap/TrackMap';
import { FlatTrackMap } from './components/TrackMap/FlatTrackMap';
import { Weather } from './components/Weather';
import { Wind } from './components/Wind';
import { FasterCarsFromBehind } from './components/FasterCarsFromBehind/FasterCarsFromBehind';
import { FuelCalculator } from './components/FuelCalculator';
import { BlindSpotMonitor } from './components/BlindSpotMonitor/BlindSpotMonitor';
import { GarageCover } from './components/GarageCover/GarageCover';
import { RejoinIndicator } from './components/RejoinIndicator/RejoinIndicator';
import { TelemetryInspector } from './components/TelemetryInspector/TelemetryInspector';
import { PitlaneHelper } from './components/PitlaneHelper/PitlaneHelper';
import { Tachometer } from './components/Tachometer/Tachometer';
import { Flag } from './components/Flag';
import { TwitchChat } from './components/TwitchChat/TwitchChat';
import { LapTimeLog } from './components/LapTimeLog/LapTimeLog';
import { InformationBar } from './components/InformationBar/InformationBar';
import { SlowCarAhead } from './components/SlowCarAhead/SlowCarAhead';
import { SectorDelta } from './components/SectorDelta/SectorDelta';
import { HeartRate } from './components/HeartRate/HeartRate';
import { CornerNameOverlay } from './components/CornerNameOverlay';
import { Rivals } from './components/Rivals/Rivals';
import type { WidgetConfigMap } from '@irdashies/types';
import type { ElementType } from 'react';

export {
  Standings,
  Input,
  Relative,
  TrackMap,
  FlatTrackMap,
  Weather,
  Wind,
  FasterCarsFromBehind,
  FuelCalculator,
  BlindSpotMonitor,
  GarageCover,
  RejoinIndicator,
  TelemetryInspector,
  PitlaneHelper,
  Tachometer,
  Flag,
  TwitchChat,
  LapTimeLog,
  InformationBar,
  SlowCarAhead,
  SectorDelta,
  HeartRate,
  CornerNameOverlay,
};

export const WIDGET_MAP: Record<keyof WidgetConfigMap, ElementType> = {
  standings: Standings,
  input: Input,
  relative: Relative,
  rivals: Rivals,
  map: TrackMap,
  flatmap: FlatTrackMap,
  weather: Weather,
  wind: Wind,
  fastercarsfrombehind: FasterCarsFromBehind,
  fuel: FuelCalculator,
  blindspotmonitor: BlindSpotMonitor,
  garagecover: GarageCover,
  rejoin: RejoinIndicator,
  telemetryinspector: TelemetryInspector,
  pitlanehelper: PitlaneHelper,
  tachometer: Tachometer,
  flag: Flag,
  twitchchat: TwitchChat,
  laptimelog: LapTimeLog,
  infobar: InformationBar,
  slowcarahead: SlowCarAhead,
  sectordelta: SectorDelta,
  heartrate: HeartRate,
  cornername: CornerNameOverlay,
};

export type WidgetId = keyof WidgetConfigMap;

/**
 * Looks up a widget component by id. Accepts a raw string because dashboard
 * config is user-supplied and may contain unknown ids; returns undefined
 * when no widget is registered for that id.
 *
 * Uses Object.hasOwn so prototype-chain keys (e.g. "__proto__", "toString")
 * never resolve to truthy non-component values that React would try to render.
 */
export const getWidget = (id: string) =>
  Object.hasOwn(WIDGET_MAP, id)
    ? (WIDGET_MAP[id as WidgetId] as (typeof WIDGET_MAP)[WidgetId])
    : undefined;
