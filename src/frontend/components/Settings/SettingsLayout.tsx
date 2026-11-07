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
import { generalItems, bottomItems } from './menuItems';
import { ReleaseNotesStatusProvider } from './ReleaseNotes/ReleaseNotesStatusContext';
import { ReleaseNotesAnnouncement } from './ReleaseNotes/ReleaseNotesAnnouncement';
import { GitHubStarPrompt } from './GitHubStarPrompt/GitHubStarPrompt';

export const SettingsLayout = () => {
  const { bridge, isDemoMode, toggleDemoMode, currentDashboard } =
    useDashboard();
  const { pathname } = useLocation();
  const appPage = [...generalItems, ...bottomItems].some(
    (item) => item.to === pathname
  );
  const lastApp = useRef('/settings/general');
  const lastOverlay = useRef('/settings/relative');
  useEffect(() => {
    if (appPage) lastApp.current = pathname;
    else if (pathname.replace(/\/$/, '') !== '/settings')
      lastOverlay.current = pathname;
  }, [appPage, pathname]);
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
        <div
          className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-700 px-5 py-3 [-webkit-app-region:drag]"
          style={{
            paddingLeft: 'max(1.25rem, env(titlebar-area-x, 0px))',
            paddingRight:
              'max(1.25rem, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)))',
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="" className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[24px] leading-7 font-semibold tracking-[-0.04em] text-white">
                  ir<span className="text-red-600">Dashies</span>
                </span>
                <h1 className="text-sm font-medium text-slate-400">
                  {appPage ? 'App settings' : 'Overlay Settings'}
                </h1>
                {simulatorName && (
                  <span className="text-xs text-slate-400">
                    {simulatorName}
                  </span>
                )}
              </div>
              <HeaderProfilePicker
                onManage={() => {
                  if (pathname === '/settings/profiles')
                    mainRef.current?.focus();
                }}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-row gap-2 [-webkit-app-region:no-drag]">
            <button
              onClick={toggleDemoMode}
              aria-pressed={isDemoMode}
              className="flex min-h-9 items-center gap-2 rounded-md border border-settings-boundary bg-slate-800 px-3 py-2 text-sm font-semibold transition-colors hover:border-accent-400 aria-pressed:border-accent-400 aria-pressed:text-accent-300"
            >
              {isDemoMode ? (
                <>
                  <PresentationChartIcon size={20} weight="bold" />
                  <span>Exit Demo</span>
                </>
              ) : (
                <>
                  <PresentationChartIcon size={20} weight="bold" />
                  <span>Demo Mode</span>
                </>
              )}
            </button>
            <button
              onClick={handleToggleLock}
              className="flex min-h-9 items-center gap-2 rounded-md border border-settings-boundary bg-slate-800 px-3 py-2 text-sm font-semibold transition-colors hover:border-accent-400"
            >
              <LockIcon size={20} weight="bold" />
              <span>Edit Layout</span>
              <kbd className="ml-1 text-xs bg-black/20 px-1 rounded">
                {editModeAccelerator}
              </kbd>
            </button>
          </div>
        </div>
        <StorageStatusNotice />
        <div className="flex min-h-0 flex-1">
          {/* Left Column - Widget Menu */}
          <SettingsMenu
            appTo={lastApp.current}
            returnTo={lastOverlay.current}
          />

          {/* Right Column - Widget Settings */}
          <main
            id="settings-content"
            ref={mainRef}
            tabIndex={-1}
            aria-label={appPage ? 'App settings page' : 'Overlay settings page'}
            className="min-w-0 flex-1 bg-slate-900 p-4 focus:outline-none lg:p-7"
          >
            <div className="mx-auto flex h-full max-w-[960px] flex-col overflow-hidden">
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/settings/relative" replace />}
                />
                <Route path="/:widgetId" element={<SettingsLoader />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </ReleaseNotesStatusProvider>
  );
};
