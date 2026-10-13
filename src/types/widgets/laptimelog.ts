import { numberOptions } from './properties';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'laptimelog',
  name: 'Lap Timer',
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 250,
    height: 250,
  },
  config: {
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: true,
    showPredictedLap: true,
    showLastLap: true,
    showBestLap: true,
    showAllTimeLap: false,
    delta: {
      enabled: true,
      method: 'bestlap',
    },
    history: {
      enabled: true,
      count: 10,
      style: 'list',
      hidePittedLaps: false,
    },
    background: {
      opacity: 80,
    },
    foreground: {
      opacity: 70,
    },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    showOnlyWhenOnTrack: true,
  },
  properties: {
    showCurrentLap: {
      type: 'boolean',
      label: 'Show Current Lap',
      description: 'Display the live lap time for the current lap.',
    },
    showPredictedLap: {
      type: 'boolean',
      label: 'Show Predicted Lap',
      description:
        'Show the current predicted lap based on the current delta time.',
    },
    showLastLap: {
      type: 'boolean',
      label: 'Show Last Lap',
      description: "Show the driver's last lap time.",
    },
    showBestLap: {
      type: 'boolean',
      label: 'Show Session Best Lap',
      description: "Show the driver's best lap time this session.",
    },
    showAllTimeLap: {
      type: 'boolean',
      label: 'Show Personal Best Lap',
      description:
        'Shows the best lap time ever recorded by irDashies for the car and track combo.',
    },
    'delta.enabled': {
      type: 'boolean',
      label: 'Display Lap Delta',
      description:
        "Choose which lap to base the delta calculation on. This can be the driver's last lap, best lap, or the overall session best lap.",
    },
    'delta.method': {
      type: 'enum',
      label: 'Delta Calculation Base Lap',
      options: [
        { value: 'lastlap', label: 'Last Lap' },
        { value: 'bestlap', label: 'Best Lap' },
      ],
    },
    'history.enabled': {
      type: 'boolean',
      label: 'Show Lap History',
      description:
        "Show the driver's lap history. You can configure how many to show below.",
    },
    'history.style': {
      type: 'enum',
      label: 'History Style',
      options: [
        { value: 'list', label: 'List' },
        { value: 'chart', label: 'Graph' },
      ],
    },
    'history.count': {
      type: 'enum',
      label: 'Number Of Laps To Show',
      options: numberOptions(1, 20),
      control: 'select',
    },
    'history.hidePittedLaps': {
      type: 'boolean',
      label: 'Hide Pitted Laps',
      description:
        'Leave out laps where you pitted. They are much slower than a green lap, so they stretch the chart and pull the average away from your real pace.',
    },
    'background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      min: 0,
      max: 100,
      step: 5,
      units: '%',
    },
    'foreground.opacity': {
      type: 'number',
      label: 'Foreground Opacity',
      min: 0,
      max: 100,
      step: 5,
      units: '%',
    },
    scale: {
      type: 'number',
      label: 'Scale',
      description:
        "Adjust the size of the font by adjusting this widget's scale",
      min: 50,
      max: 150,
      step: 1,
      units: '%',
    },
    reverse: {
      type: 'boolean',
      label: 'Reverse Order',
      description: 'Display the lap time elements in reverse order',
    },
    alignment: {
      type: 'enum',
      label: 'Widget Alignment',
      options: [
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' },
      ],
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, lap times will only be shown when driving',
    },
  },
});
