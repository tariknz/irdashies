import { EventEmitter } from 'node:events';
import { DashboardLayout } from '@irdashies/types';

const dashboardEvents = new EventEmitter();

export const onDashboardUpdated = (
  listener: (dashboard: DashboardLayout, saveId?: string) => void
) => {
  dashboardEvents.on('dashboardUpdated', listener);
  return () => {
    dashboardEvents.removeListener('dashboardUpdated', listener);
  };
};

export const emitDashboardUpdated = (
  dashboard: DashboardLayout,
  saveId?: string
) => {
  dashboardEvents.emit('dashboardUpdated', dashboard, saveId);
};

/** Fires on every persisted dashboard change, whichever profile it belongs to. */
export const onDashboardsSaved = (listener: () => void) => {
  dashboardEvents.on('dashboardsSaved', listener);
  return () => {
    dashboardEvents.removeListener('dashboardsSaved', listener);
  };
};

export const emitDashboardsSaved = () => {
  dashboardEvents.emit('dashboardsSaved');
};
