import { InputSettings } from '../Input/InputContainer/InputContainer';

/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface BaseWidgetSettings<T = Record<string, unknown>> {
  enabled: boolean;
  config: T;
}

export interface StandingsWidgetSettings extends BaseWidgetSettings {
  // Add specific standings settings here
}

export interface RelativeWidgetSettings extends BaseWidgetSettings {
  // Add specific relative settings here
}

export interface WeatherWidgetSettings extends BaseWidgetSettings {
  // Add specific weather settings here
}

export interface TrackMapWidgetSettings extends BaseWidgetSettings {
  // Add specific track map settings here
}

export type InputWidgetSettings = BaseWidgetSettings<InputSettings>;

export interface AdvancedSettings extends BaseWidgetSettings {
  // Add specific advanced settings here
}