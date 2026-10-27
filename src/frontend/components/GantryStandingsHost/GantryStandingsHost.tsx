import { memo, useCallback, useMemo } from 'react';
import { WarningIcon } from '@phosphor-icons/react';
import {
  SessionTimingUpdater,
  useDashboard,
  usePitLapStoreUpdater,
  usePushToPassStoreUpdater,
  useRunningState,
  useSessionDrivers,
} from '@irdashies/context';
import {
  StandingsInteractionProvider,
  StandingsSettingsProvider,
  useFocusDriver,
} from '@irdashies/domain';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import {
  resolveGantryStandings,
  type DashboardWidget,
  type GantryStandingsSource,
  type ResolvedGantryStandings,
  type StandingsWidgetSettings,
} from '@irdashies/types';
import { getWidget } from '../../WidgetIndex';
import { WidgetRuntimeProvider } from '../../widgetRuntime';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import { RendererDataProviders } from '../RendererDataProviders/RendererDataProviders';
import { useSessionHold } from '@irdashies/domain/sessionHold/useSessionHold';

type StandingsConfig = StandingsWidgetSettings['config'];

const ALL_SESSIONS = {
  race: true,
  loneQualify: true,
  openQualify: true,
  practice: true,
  offlineTesting: true,
  warmup: true,
};

/**
 * The Gantry is always on screen and tall, so the overlay's hide rules do not
 * apply, and the overlay's own settings list the whole field there.
 */
export const gantryStandingsRenderConfig = (
  config: StandingsConfig,
  source: GantryStandingsSource
): StandingsConfig => ({
  ...config,
  showOnlyWhenOnTrack: false,
  sessionVisibility: ALL_SESSIONS,
  driverStandings: {
    ...config.driverStandings,
    showAll: source === 'overlay' ? true : config.driverStandings?.showAll,
  },
});

/** Which Standings widget the Gantry shows, per the saved dashboard. */
export const useGantryStandings = (): ResolvedGantryStandings => {
  const { currentDashboard } = useDashboard();
  return useMemo(
    () => resolveGantryStandings(currentDashboard),
    [currentDashboard]
  );
};

// The overlay's own updaters are not mounted in the Gantry window.
const StandingsUpdaters = ({ config }: { config: StandingsConfig }) => {
  usePitLapStoreUpdater(!!config.pitStatus?.enabled);
  usePushToPassStoreUpdater(!!config.pushToPass?.enabled);
  return <SessionTimingUpdater soloWidgetType="standings" />;
};

const STANDINGS_ERROR = (
  <div className="h-full flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-400">
    <WarningIcon size={18} className="text-slate-500" />
    <p>The standings hit a problem. They will try again shortly.</p>
  </div>
);

interface GantryStandingsHostProps {
  widget: DashboardWidget;
  source: GantryStandingsSource;
  followedCarIdx: number | null;
}

/**
 * Renders a Standings widget as the Gantry's left pane, with the Gantry's row
 * click, follow highlight and post-session hold. A host, like GantryDockHost:
 * Gantry only receives what it renders.
 */
export const GantryStandingsHost = memo(
  ({ widget, source, followedCarIdx }: GantryStandingsHostProps) => {
    const { running } = useRunningState();
    const { holding } = useSessionHold();
    const drivers = useSessionDrivers();
    const focusDriver = useFocusDriver();
    const widgets = useMemo(() => [widget], [widget]);
    const config = useMemo(
      () =>
        gantryStandingsRenderConfig(
          widget.config as unknown as StandingsConfig,
          source
        ),
      [widget.config, source]
    );

    const handleSelectCar = useCallback(
      (carIdx: number) => {
        const carNumber = drivers?.find(
          (driver) => driver.CarIdx === carIdx
        )?.CarNumber;
        if (carNumber) focusDriver(carNumber);
      },
      [drivers, focusDriver]
    );
    const interaction = useMemo(
      () => ({
        onSelectCar: handleSelectCar,
        highlightedCarIdx: followedCarIdx,
      }),
      [handleSelectCar, followedCarIdx]
    );

    const Standings = getWidget('standings');
    if (!Standings) return null;

    return (
      <ErrorBoundary
        label="gantry-standings"
        resetAfterMs={2000}
        fallback={STANDINGS_ERROR}
      >
        {/* Session data comes from GantryApp's own provider. */}
        <RendererDataProviders widgets={widgets} sessionAlreadyMounted />
        <WidgetRuntimeProvider widgetType="standings">
          {running || holding ? (
            <>
              <StandingsUpdaters config={config} />
              <WidgetScale scale={widget.scale}>
                <StandingsSettingsProvider config={config}>
                  <StandingsInteractionProvider value={interaction}>
                    <div className="h-full overflow-y-auto">
                      {/* No fixed height here, so the table takes its own and
                          the scroll container above does the scrolling. */}
                      <div>
                        <Standings />
                      </div>
                    </div>
                  </StandingsInteractionProvider>
                </StandingsSettingsProvider>
              </WidgetScale>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-3 text-xs text-slate-400">
              Waiting for iRacing.
            </div>
          )}
        </WidgetRuntimeProvider>
      </ErrorBoundary>
    );
  }
);
GantryStandingsHost.displayName = 'GantryStandingsHost';
