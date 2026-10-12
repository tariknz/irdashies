import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'battle',
  name: 'Battle',
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 460,
    height: 100,
  },
  config: {
    background: { opacity: 80 },
    showOnlyWhenOnTrack: false,
    position: { enabled: true },
    carNumber: { enabled: true },
    driverName: { enabled: true },
    stint: { enabled: true },
    lastTime: { enabled: true, timeFormat: 'mixed' },
    speed: { enabled: false, unit: 'auto' },
    gap: { enabled: true, decimalPlaces: 2 },
    displayOrder: [
      'position',
      'carNumber',
      'driverName',
      'stint',
      'lastTime',
      'speed',
      'gap',
    ],
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: false,
      practice: false,
      offlineTesting: false,
    },
  },
  properties: {
    'lastTime.timeFormat': {
      type: 'enum',
      label: 'Time Format',
      options: [
        { value: 'full', label: 'Full (1:23.456)' },
        { value: 'mixed', label: 'Mixed (1:23.4)' },
        { value: 'minutes', label: 'Minutes (1:23)' },
        { value: 'seconds-full', label: 'Seconds full (83.456)' },
        { value: 'seconds-mixed', label: 'Seconds mixed (83.4)' },
        { value: 'seconds', label: 'Seconds (83)' },
      ],
      control: 'select',
    },
    'speed.unit': {
      type: 'enum',
      label: 'Unit',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'mph', label: 'MPH' },
        { value: 'km/h', label: 'KM/H' },
      ],
    },
    'gap.decimalPlaces': {
      type: 'enum',
      label: 'Decimal Places',
      options: [
        { value: 1, label: '1 (0.0s)' },
        { value: 2, label: '2 (0.00s)' },
        { value: 3, label: '3 (0.000s)' },
      ],
      control: 'select',
    },
    'background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      description: 'Opacity of the widget background',
      min: 0,
      max: 100,
      step: 1,
      units: '%',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, widget will only be shown when driving',
    },
  },
});
