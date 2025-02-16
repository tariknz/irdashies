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
    },
    {
      id: 'map',
      enabled: false,
      layout: {
        x: 1130,
        y: 51,
        width: 400,
        height: 600,
      },
    },
    {
      id: 'weather',
      enabled: true,
      layout: {
        x: 1000,
        y: 1000,
        width: 400,
        height: 700
      }
    }
  ],
};
