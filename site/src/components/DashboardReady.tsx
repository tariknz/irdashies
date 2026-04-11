import { type ReactNode } from 'react';
import { useDashboard } from '@irdashies/context';

interface DashboardReadyProps {
  children: ReactNode;
}

export function DashboardReady({ children }: DashboardReadyProps) {
  const { currentDashboard } = useDashboard();

  if (!currentDashboard) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">
          Loading...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
