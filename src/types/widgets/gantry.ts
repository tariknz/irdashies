import { DEFAULT_INCIDENT_CAMERA_GROUP } from '../widgetConfigs';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'gantry',
  name: 'The Gantry',
  menuLabel: 'Gantry',
  enabled: false,
  layout: {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
  },
  config: {
    speedUnit: 'auto',
    driverNameFormat: 'surname',
    thresholdsVersion: 3,
    slowSpeedThreshold: 15,
    slowDurationSeconds: 1,
    impactDecelKmhPerSec: 150,
    impactMinSpeed: 20,
    offTrackDurationSeconds: 0.3,
    pitEntryDurationSeconds: 0.6,
    cooldownSeconds: 5,
    sessionRetention: 'all',
    incidentCameraGroup: DEFAULT_INCIDENT_CAMERA_GROUP,
    lapGraph: {
      yAxisMode: 'trace',
      lapWindow: 75,
      autoPin: true,
    },
    window: {
      alwaysOnTop: false,
    },
    dock: {
      enabled: false,
      arrangement: 'row',
      panels: [],
    },
  },
  properties: {
    'window.alwaysOnTop': {
      type: 'boolean',
      label: 'Keep on top of other windows',
      description:
        'The Gantry stays visible above iRacing and other apps. iRacing must run in borderless or windowed mode. Exclusive fullscreen hides every window, including this one.',
    },
  },
});
