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
  useActiveSimulator,
  useDashboard,
  useRunningState,
} from '@irdashies/context';
import { simulatorDisplayName } from '@irdashies/types';
import { SettingsLoader } from './SettingsLoader';
import { SettingsMenu } from './SettingsMenu';
import { HeaderProfilePicker } from './components/HeaderProfilePicker';
import { generalItems, bottomItems, toolItems } from './menuItems';
import { ReleaseNotesStatusProvider } from './ReleaseNotes/ReleaseNotesStatusContext';
import { ReleaseNotesAnnouncement } from './ReleaseNotes/ReleaseNotesAnnouncement';
import { GitHubStarPrompt } from './GitHubStarPrompt/GitHubStarPrompt';
import { SettingsPreviewPanelContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';

export const SettingsLayout = () => {
  const previewPanelWidth = useState(420);
  const { bridge, isDemoMode, toggleDemoMode, currentDashboard } =
    useDashboard();
  const { pathname } = useLocation();
  const appPage = [...generalItems, ...bottomItems].some(
    (item) => item.to === pathname
  );
  // Tool pages are neither overlays nor app settings: they keep their own
  // last page, so Back to overlays never lands on one.
  const toolPage = toolItems.some((item) => item.to === pathname);
  const lastApp = useRef('/settings/general');
  const lastTool = useRef('/settings/profiles');
  const lastOverlay = useRef('/settings/relative');
  useEffect(() => {
    if (appPage) lastApp.current = pathname;
    else if (toolPage) lastTool.current = pathname;
    else if (pathname.replace(/\/$/, '') !== '/settings')
      lastOverlay.current = pathname;
  }, [appPage, toolPage, pathname]);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) mainRef.current?.focus();
    previousPath.current = pathname;
  }, [pathname]);
  const navigate = useNavigate();
  const [editModeAccelerator, setEditModeAccelerator] = useState('F6');
  const activeSimulator = useActiveSimulator();
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
          <h1 className="sr-only">
            {appPage ? 'App settings' : toolPage ? 'Tools' : 'Overlay Settings'}
          </h1>
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
            returnTo={lastOverlay.current}
          />

          {/* Right Column - Widget Settings */}
          <main
            id="settings-content"
            ref={mainRef}
            tabIndex={-1}
            aria-label={
              appPage
                ? 'App settings page'
                : toolPage
                  ? 'Tools page'
                  : 'Overlay settings page'
            }
            className="min-w-0 flex-1 bg-slate-900 px-4 pt-4 pb-3 focus:outline-none lg:px-7 lg:pt-7"
          >
            <div
              className={`mx-auto flex h-full flex-col overflow-hidden ${appPage ? 'max-w-[960px]' : 'max-w-[1440px]'}`}
            >
              <SettingsPreviewPanelContext value={previewPanelWidth}>
                <Routes>
                  <Route
                    path="/"
                    element={<Navigate to="/settings/relative" replace />}
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
