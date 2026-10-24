import type { DashboardLayout } from '@irdashies/types';
import { onDashboardUpdated } from '../storage/dashboardEvents';
import {
  StreamChatService,
  type StreamChatPublisher,
} from './streamChatService';

/**
 * Hosts the Stream Chat connections for as long as the app runs and follows
 * the dashboard: nothing connects until the widget is enabled and a channel
 * is set. Returns the function that tears everything down.
 */
export const setupStreamChat = (
  bus: StreamChatPublisher,
  initialDashboard: DashboardLayout | undefined
): (() => void) => {
  const service = new StreamChatService(bus);
  service.applyDashboard(initialDashboard);
  const unsubscribe = onDashboardUpdated((dashboard) =>
    service.applyDashboard(dashboard)
  );
  return () => {
    unsubscribe();
    service.dispose();
  };
};
