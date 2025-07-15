import { InputSettings } from '../Input/InputContainer/InputContainer';

/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface BaseWidgetSettings<T = Record<string, unknown>> {
  enabled: boolean;
  config: T;
}

export interface StandingsWidgetSettings extends BaseWidgetSettings {
  config: {
    iRatingChange: { enabled: boolean };
    badge: { enabled: boolean };
    delta: { enabled: boolean };
    lastTime: { enabled: boolean };
    fastestTime: { enabled: boolean };
    background: { opacity: number };
  };
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  config: {
    buffer: number;
    background: { opacity: number };
  };
}

export interface WeatherWidgetSettings extends BaseWidgetSettings {
  config: {
    background: { opacity: number };
  };
}

export interface TrackMapWidgetSettings extends BaseWidgetSettings {
  config: {
    enableTurnNames: boolean;
  };
}

export type InputWidgetSettings = BaseWidgetSettings<InputSettings>;

export interface AdvancedSettings extends BaseWidgetSettings {
  // Add specific advanced settings here
}