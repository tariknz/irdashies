import type { DashboardLayout } from '@irdashies/types';

export const defaultDashboard: DashboardLayout = {
  widgets: [
    {
      id: 'standings',
      enabled: true,
      layout: {
        x: 50,
        y: 50,
        width: 400,
        height: 600,
      },
      config: {
        iRatingChange: { enabled: true },
        badge: { enabled: true },
        delta: { enabled: true },
        lastTime: { enabled: true },
        fastestTime: { enabled: true },
        backgroundOpacity: { value: 0 },
        countryFlags: { enabled: true },
        carNumber: { enabled: true },
      },
    },
    {
      id: 'input',
      enabled: true,
      layout: {
        x: 50,
        y: 50,
        width: 600,
        height: 120,
      },
      config: {
        trace: {
          enabled: true,
          includeThrottle: true,
          includeBrake: true,
        },
        bar: {
          enabled: true,
          includeClutch: true,
          includeBrake: true,
          includeThrottle: true,
        },
        gear: {
          enabled: true,
          unit: 'auto',
        },
        steer: {
          enabled: true,
        },
      },
    },
    {
      id: 'relative',
      enabled: true,
      layout: {
        x: 1135,
        y: 759,
        width: 400,
        height: 296,
      },
      config: {
        buffer: 3,
        backgroundOpacity: { value: 0 },
        countryFlags: { enabled: true },
        carNumber: { enabled: true },
      },
    },
    {
      id: 'map',
      enabled: true,
      layout: {
        x: 1130,
        y: 51,
        width: 400,
        height: 600,
      },
      config: {
        enableTurnNames: false,
      },
    },
    {
      id: 'weather',
      enabled: true,
      layout: {
        x: 1000,
        y: 1000,
        width: 160,
        height: 380,
      },
      config: {
        backgroundOpacity: { value: 25 },
      },
    },
    {
      id: 'fastercarsfrombehind',
      enabled: true,
      layout: {
        x: 700,
        y: 200,
        width: 400,
        height: 40,
      },
    }
  ],
  generalSettings: {
    fontSize: 'sm',
    colorPalette: 'default',
  },
};
