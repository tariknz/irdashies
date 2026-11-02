import { useMemo } from 'react';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  useDashboard,
  useResetOnDisconnect,
  useRunningState,
} from '@irdashies/context';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import { Gantry } from '../components/Gantry/Gantry';
import {
  GantryDockHost,
  useGantryDock,
} from '../components/GantryDock/GantryDockHost';
import {
  GantryStandingsHost,
  useGantryStandings,
} from '../components/GantryStandingsHost/GantryStandingsHost';
import { GantrySessionHoldProvider } from '../components/Gantry/hooks/useGantrySessionHold';
import { ThemeManager } from '../components/ThemeManager/ThemeManager';
import { WidgetRuntimeProvider } from '../widgetRuntime';

const GantryContent = () => {
  const { running } = useRunningState();
  const { currentDashboard } = useDashboard();
  const gantry = currentDashboard?.widgets.find(
    (widget) => (widget.type || widget.id) === 'gantry'
  );
  useResetOnDisconnect(running);
  const dock = useGantryDock();
  const dockHost = useMemo(
    () => (dock.panels.length > 0 ? <GantryDockHost dock={dock} /> : undefined),
    [dock]
  );
  const standings = useGantryStandings();
  const renderStandings = useMemo(
    () =>
      standings.status === 'ready'
        ? (followedCarIdx: number | null) => (
            <GantryStandingsHost
              widget={standings.widget}
              source={standings.source}
              followedCarIdx={followedCarIdx}
            />
          )
        : undefined,
    [standings]
  );
  return (
    <WidgetRuntimeProvider widgetType="gantry">
      <ThemeManager>
        <div className="w-full h-full bg-slate-900 text-white">
          <GantrySessionHoldProvider running={running}>
            <WidgetScale scale={gantry?.scale}>
              <Gantry dock={dockHost} standings={renderStandings} />
            </WidgetScale>
          </GantrySessionHoldProvider>
        </div>
      </ThemeManager>
    </WidgetRuntimeProvider>
  );
};

export default function GantryWindow() {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <GantryContent />
      </RunningStateProvider>
    </DashboardProvider>
  );
}
