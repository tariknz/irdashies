import { StorageStatusNotice } from './StorageStatus/StorageStatusNotice';
import logo from '../../assets/icons/logo.svg';
import { useEffect, useRef, useState } from 'react';
import { LockIcon, PresentationChartIcon } from '@phosphor-icons/react';
import {
  Route,
  Routes,
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  useActiveSimulatorStatus,
  useDashboard,
  useRunningState,
  useSimWidgetSupportStatus,
} from '@irdashies/context';
import { simulatorDisplayName, widgetDisabledMessage } from '@irdashies/types';
import { SettingsLoader, WIDGET_SETTINGS } from './SettingsLoader';
import { SettingsMenu } from './SettingsMenu';
import { HeaderProfilePicker } from './components/HeaderProfilePicker';
import { settingsPageKind, type SettingsPageKind } from './settingsPageKind';
import { widgetSettingsType } from './widgetSettingsType';
import {
  DEFAULT_WIDGET_PAGE,
  existingWidgetPage,
  readLastWidgetPage,
  saveLastWidgetPage,
  startWidgetPage,
} from './lastWidgetPage';
import { ReleaseNotesStatusProvider } from './ReleaseNotes/ReleaseNotesStatusContext';
import { ReleaseNotesAnnouncement } from './ReleaseNotes/ReleaseNotesAnnouncement';
import { GitHubStarPrompt } from './GitHubStarPrompt/GitHubStarPrompt';
import { SettingsPreviewPanelContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';

/** How many overlay pages Back to overlays can walk back through. */
const VISITED_OVERLAYS = 20;

/** Marks the history entry of the page Settings reopened at start. */
const RESTORED = { restoredWidgetPage: true };

const PAGE_HEADINGS: Record<SettingsPageKind, string> = {
  app: 'App settings',
  tool: 'Tools',
  overlay: 'Overlay Settings',
};

const MAIN_LABELS: Record<SettingsPageKind, string> = {
  app: 'App settings page',
  tool: 'Tools page',
  overlay: 'Overlay settings page',
};

export const SettingsLayout = () => {
  const previewPanelWidth = useState(420);
  const { bridge, isDemoMode, toggleDemoMode, currentDashboard } =
    useDashboard();
  // Without a trailing slash: TrailingSlashRedirect at the route sees to it.
  const location = useLocation();
  const { pathname } = location;
  // Still on the page reopened at start: the user has not moved since.
  const restored =
    (location.state as typeof RESTORED | null)?.restoredWidgetPage === true;
  const pageKind = settingsPageKind(pathname);
  const appPage = pageKind === 'app';
  const toolPage = pageKind === 'tool';
  const lastApp = useRef('/settings/general');
  // Tool pages are neither overlays nor app settings: they keep their own
  // last page, so Back to overlays never lands on one.
  const lastTool = useRef('/settings/profiles');
  // The widget page open when irDashies last quit, read once at start.
  const [storedWidgetPage] = useState(readLastWidgetPage);
  // The overlay pages visited this session, oldest first.
  const visitedOverlays = useRef<string[]>([]);
  const { simulator: activeSimulator, loaded: simulatorLoaded } =
    useActiveSimulatorStatus();
  const { config: supportConfig, loaded: supportLoaded } =
    useSimWidgetSupportStatus();
  // A sim not confirmed yet -- the one the store last knew, kept while it
  // asks again -- counts as unknown: rejecting a page on it would open
  // Relative and lose the page left last even when the answer can run it.
  const knownSimulator = simulatorLoaded ? activeSimulator : null;
  // A widget with a settings page of its own: a widget type, or a copy in
  // this layout, which resolves to its type. The Telemetry Inspector has
  // none (its settings are on Advanced).
  const hasWidgetPage = (id: string) =>
    Object.hasOwn(
      WIDGET_SETTINGS,
      widgetSettingsType(currentDashboard?.widgets, id)
    );
  // Worth reopening at the next start: it has a page, and the sim connected
  // now can run it. An unsupported widget's row is hidden from the menu, so
  // Settings opens on Relative instead.
  const canReopen = (id: string) =>
    hasWidgetPage(id) &&
    !widgetDisabledMessage(
      supportConfig,
      widgetSettingsType(currentDashboard?.widgets, id),
      knownSimulator
    );
  const overlayPage = existingWidgetPage(pathname, hasWidgetPage);
  const reopenablePage = existingWidgetPage(pathname, canReopen);
  useEffect(() => {
    if (appPage) lastApp.current = pathname;
    else if (toolPage) lastTool.current = pathname;
  }, [appPage, toolPage, pathname]);
  // Only a page that counts goes on the way back or is kept to reopen:
  // passing through the Telemetry Inspector changes neither.
  useEffect(() => {
    if (!overlayPage) return;
    visitedOverlays.current = [
      ...visitedOverlays.current.filter((path) => path !== overlayPage),
      overlayPage,
    ].slice(-VISITED_OVERLAYS);
  }, [overlayPage]);
  // Kept only once the support file and the simulator have answered: until
  // then the bundled defaults, or a sim not known yet, can allow a page that
  // cannot be reopened, and saving it would lose the page left last.
  useEffect(() => {
    if (supportLoaded && simulatorLoaded && reopenablePage)
      saveLastWidgetPage(reopenablePage);
  }, [supportLoaded, simulatorLoaded, reopenablePage]);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) mainRef.current?.focus();
    previousPath.current = pathname;
  }, [pathname]);
  const navigate = useNavigate();
  // The simulator can arrive after the page is reopened, and turn out to be
  // one that cannot run it. Its row is hidden from the menu: leave it for
  // Relative. A page the user opened stays open. The support file is not a
  // concern here: the page is reopened only once it has arrived. Once the
  // simulator is known and can run the page, the mark is dropped: the page
  // is then the user's, and a sim change later leaves it open.
  useEffect(() => {
    if (!restored) return;
    if (!reopenablePage) {
      if (pathname !== DEFAULT_WIDGET_PAGE)
        navigate(DEFAULT_WIDGET_PAGE, { replace: true });
    } else if (simulatorLoaded) {
      navigate(
        { pathname, search: location.search, hash: location.hash },
        { replace: true, state: null }
      );
    }
  }, [
    restored,
    reopenablePage,
    simulatorLoaded,
    pathname,
    location.search,
    location.hash,
    navigate,
  ]);
  const [editModeAccelerator, setEditModeAccelerator] = useState('F6');
  const { running } = useRunningState();
  // The name says which sim is feeding the overlays, so it has no business
  // being up when none is. The active simulator is deliberately not cleared on
  // a disconnect -- that drives widget filtering and would rebuild every
  // overlay window -- so the running state is what gates the display.
  const simulatorName = running ? simulatorDisplayName(activeSimulator) : null;

  useEffect(() => {
    window.keybindingsBridge?.getKeybindings().then((bindings) => {
      setEditModeAccelerator(bindings['toggle-edit-mode'].accelerator);
    });
  }, [pathname]);

  useEffect(() => {
    const unsub = window.dashboardBridge?.onNavigateToSettings?.(
      (widgetType) => {
        navigate(`/settings/${widgetType}`);
      }
    );
    return () => unsub?.();
  }, [navigate]);

  const handleToggleLock = async () => {
    await bridge.toggleLockOverlays();
  };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  // Settings open on the widget page left last, while it can be reopened.
  const startPage = startWidgetPage(storedWidgetPage, canReopen);
  // Back to overlays: the latest overlay page visited this session that
  // still exists. A profile switch can take a layout copy away without
  // remounting this, and then the one before it is the way back.
  const overlayReturn =
    visitedOverlays.current.findLast(
      (path) => existingWidgetPage(path, hasWidgetPage) !== undefined
    ) ?? startPage;

  return (
    <ReleaseNotesStatusProvider>
      <div className="settings-shell flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-200">
        <a
          href="#settings-content"
          onClick={(event) => {
            event.preventDefault();
            mainRef.current?.focus();
          }}
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-slate-800 focus:px-4 focus:py-2 focus:text-slate-200 [-webkit-app-region:no-drag]"
        >
          Skip to settings
        </a>
        {!appPage && (
          <Link
            to={lastApp.current}
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-slate-800 focus:px-4 focus:py-2 focus:text-slate-200 [-webkit-app-region:no-drag]"
          >
            Go to App settings
          </Link>
        )}
        <ReleaseNotesAnnouncement />
        <GitHubStarPrompt />
        {/* The window has no native title bar: this row is the drag handle, and
          the side padding keeps clear of the OS window controls. Their
          width comes from the window-controls-overlay env() values, so it
          follows DPI scaling; without an overlay it resolves to 0. */}
        <header
          className="grid min-h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-slate-700 px-4 py-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] [-webkit-app-region:drag]"
          style={{
            paddingLeft: 'calc(env(titlebar-area-x, 0px) + 1rem)',
            paddingRight:
              'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 1rem)',
          }}
        >
          <h1 className="sr-only">{PAGE_HEADINGS[pageKind]}</h1>
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="" className="h-7 w-7 shrink-0" />
            <span className="hidden shrink-0 text-lg font-semibold tracking-[-0.04em] text-white md:inline">
              ir<span className="text-red-600">Dashies</span>
            </span>
            <HeaderProfilePicker
              onManage={() => {
                if (pathname === '/settings/profiles') mainRef.current?.focus();
              }}
            />
          </div>
          <div className="hidden min-w-0 items-center justify-self-center gap-2 text-xs text-slate-400 sm:flex">
            {simulatorName && (
              <>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                  aria-hidden="true"
                />
                <span className="truncate">{simulatorName} connected</span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-self-end gap-2 [-webkit-app-region:no-drag]">
            <button
              type="button"
              onClick={toggleDemoMode}
              aria-label={isDemoMode ? 'Exit Demo' : 'Demo Mode'}
              title={isDemoMode ? 'Exit Demo' : 'Demo Mode'}
              aria-pressed={isDemoMode}
              className="flex min-h-8 items-center gap-2 rounded-md border border-settings-boundary bg-slate-800 px-2 py-1 text-sm font-semibold transition-colors hover:border-accent-400 lg:px-3 aria-pressed:border-accent-400 aria-pressed:text-accent-300"
            >
              <PresentationChartIcon size={16} weight="bold" />
              <span className="hidden lg:inline">
                {isDemoMode ? 'Exit Demo' : 'Demo Mode'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleToggleLock}
              aria-label="Edit Layout"
              title={`Edit Layout (${editModeAccelerator})`}
              className="flex min-h-8 items-center gap-2 rounded-md border border-settings-boundary bg-slate-800 px-2 py-1 text-sm font-semibold transition-colors hover:border-accent-400 lg:px-3"
            >
              <LockIcon size={16} weight="bold" />
              <span className="hidden lg:inline">Edit Layout</span>
              <kbd className="ml-1 hidden rounded bg-black/20 px-1 text-xs lg:inline">
                {editModeAccelerator}
              </kbd>
            </button>
          </div>
        </header>
        <StorageStatusNotice />
        <div className="flex min-h-0 flex-1">
          {/* Left Column - Widget Menu */}
          <SettingsMenu
            appTo={lastApp.current}
            toolsTo={lastTool.current}
            returnTo={overlayReturn}
          />

          {/* Right Column - Widget Settings */}
          <main
            id="settings-content"
            ref={mainRef}
            tabIndex={-1}
            aria-label={MAIN_LABELS[pageKind]}
            className="min-w-0 flex-1 bg-slate-900 px-4 pt-4 pb-3 focus:outline-none lg:px-7 lg:pt-7"
          >
            <div
              className={`mx-auto flex h-full flex-col overflow-hidden ${appPage ? 'max-w-[960px]' : 'max-w-[1440px]'}`}
            >
              <SettingsPreviewPanelContext value={previewPanelWidth}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      // The bundled defaults can disable a page the user's
                      // support file allows: wait for the file.
                      supportLoaded ? (
                        <Navigate to={startPage} replace state={RESTORED} />
                      ) : null
                    }
                  />
                  <Route path="/:widgetId" element={<SettingsLoader />} />
                </Routes>
              </SettingsPreviewPanelContext>
            </div>
          </main>
        </div>
      </div>
    </ReleaseNotesStatusProvider>
  );
};
