import { EventEmitter } from 'node:events';
import { DashboardLayout } from '@irdashies/types';

const dashboardEvents = new EventEmitter();

export const onDashboardUpdated = (
  listener: (dashboard: DashboardLayout) => void
) => {
  dashboardEvents.on('dashboardUpdated', listener);
  return () => {
    dashboardEvents.removeListener('dashboardUpdated', listener);
  };
};

export const emitDashboardUpdated = (dashboard: DashboardLayout) => {
  dashboardEvents.emit('dashboardUpdated', dashboard);
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
