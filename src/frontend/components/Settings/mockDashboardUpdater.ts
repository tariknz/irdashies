import type { DashboardLayout } from '@irdashies/types';
import type { useDashboard } from '@irdashies/context';

export const mockDashboardUpdater =
  (
    read: () => DashboardLayout | undefined,
    save: (dashboard: DashboardLayout) => void
  ): NonNullable<ReturnType<typeof useDashboard>['onDashboardUpdated']> =>
  (update) => {
    if (typeof update !== 'function') {
      save(update);
      return;
    }
    const current = read();
    if (!current) return;
    const next = update(current);
    if (next !== current) save(next);
  };
