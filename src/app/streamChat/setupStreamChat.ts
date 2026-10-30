import type { DashboardLayout } from '@irdashies/types';
import {
  onDashboardUpdated,
  onDashboardsSaved,
} from '../storage/dashboardEvents';
import {
  StreamChatService,
  type StreamChatPublisher,
} from './streamChatService';

/**
 * Hosts the Stream Chat connections for as long as the app runs and follows
 * the dashboards of every profile: nothing connects until some profile has the
 * widget enabled and a channel set. Returns the function that tears everything
 * down.
 */
export const setupStreamChat = (
  bus: StreamChatPublisher,
  listDashboards: () => Record<string, DashboardLayout>
): (() => void) => {
  const service = new StreamChatService(bus);
  const apply = () => service.applyDashboards(Object.values(listDashboards()));
  apply();
  // A save to an inactive profile never reaches onDashboardUpdated, yet a
  // browser source can be pinned to that profile.
  const unsubscribers = [onDashboardUpdated(apply), onDashboardsSaved(apply)];
  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    service.dispose();
  };
};
