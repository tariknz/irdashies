import { StorageStatusNotice } from '../StorageStatus/StorageStatusNotice';
import logo from '../../../assets/icons/logo.svg';
import { useEffect, useRef, useState } from 'react';
import {
  GearIcon,
  CaretDownIcon,
  CheckIcon,
  LockIcon,
  PresentationChartIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
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
import { SettingsLoader } from '../SettingsLoader';
import {
  ResearchMenu,
  AppNavigationBand,
  type NavigationVariant,
} from './ResearchMenu';
import { ReleaseNotesStatusProvider } from '../ReleaseNotes/ReleaseNotesStatusContext';
import { ReleaseNotesAnnouncement } from '../ReleaseNotes/ReleaseNotesAnnouncement';
import { generalItems, bottomItems } from '../menuItems';

const HeaderProfilePicker = ({ onManage }: { onManage: () => void }) => {
  const { currentProfile, profiles, switchProfile } = useDashboard();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const choose = async (id: string) => {
    setPending(true);
    setError('');
    try {
      if (id !== currentProfile?.id) await switchProfile(id);
      setOpen(false);
      trigger.current?.focus();
    } catch {
      setError('Unable to switch profile. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      ref={container}
      className="relative [-webkit-app-region:no-drag]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose profile, current: ${currentProfile?.name ?? 'Loading'}`}
        aria-expanded={open}
        aria-controls="research-header-profiles"
        onClick={() => setOpen((value) => !value)}
        className="-ml-2 flex min-h-7 max-w-full items-center gap-1.5 rounded-md px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        <span className="truncate">
          {currentProfile?.name ?? 'Loading'} Profile
        </span>
        <CaretDownIcon size={12} className="shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="research-header-profiles"
          className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-6rem)] rounded-md border border-settings-boundary bg-slate-950 p-2 shadow-xl"
        >
          <p className="px-2 pb-1 text-xs text-slate-400">Switch profile</p>
          <div className="max-h-60 overflow-y-auto">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                disabled={pending}
                aria-pressed={profile.id === currentProfile?.id}
                onClick={() => void choose(profile.id)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50 aria-pressed:bg-accent-400/10 aria-pressed:text-accent-200"
              >
                <span className="min-w-0 break-words">{profile.name}</span>
                {profile.id === currentProfile?.id && (
                  <CheckIcon
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
          <Link
            to="/settings/profiles"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="mt-2 flex min-h-9 items-center border-t border-slate-700 px-2 pt-2 text-sm text-slate-200 hover:text-accent-200"
          >
            Manage profiles…
          </Link>
          {error && (
            <p role="alert" className="px-2 pt-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Storybook-only shell fork; route content and product chrome are reused unchanged.
export const NavigationPrototype = ({
  variant,
  profileShortcut = false,
  headerProfilePicker = false,
}: {
  variant: NavigationVariant;
  profileShortcut?: boolean;
  headerProfilePicker?: boolean;
  initialPath?: string;
  simulator?: 'iracing' | 'lmu';
}) => {
  const {
    bridge,
    isDemoMode,
    toggleDemoMode,
    currentDashboard,
    currentProfile,
  } = useDashboard();
  const { pathname } = useLocation();
  const contextual = variant === 'contextual' || variant === 'dedicated';
  const appArea = [...generalItems, ...bottomItems].some(
    (item) => item.to === pathname
  );
  const lastApp = useRef('/settings/general');
  const lastOverlay = useRef('/settings/relative');
  useEffect(() => {
    if (!contextual) return;
    if (appArea) lastApp.current = pathname;
    else lastOverlay.current = pathname;
  }, [appArea, contextual, pathname]);
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
      <div className="settings-shell flex h-full w-full flex-col bg-slate-950 text-slate-200">
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
        {variant === 'dedicated' && !appArea && (
          <Link
            to={lastApp.current}
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-slate-800 focus:px-4 focus:py-2 focus:text-slate-200 [-webkit-app-region:no-drag]"
          >
            Go to App settings
          </Link>
        )}
        <ReleaseNotesAnnouncement />
        {/* The window has no native title bar: this row is the drag handle, and
          the right padding keeps clear of the OS min/max/close buttons. Their
          width comes from the window-controls-overlay env() values, so it
          follows DPI scaling; without an overlay it resolves to 0. */}
        <div
          className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-700 px-5 py-3 [-webkit-app-region:drag]"
          style={{
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
                  {contextual
                    ? appArea
                      ? 'App settings'
                      : 'Overlay Settings'
                    : 'Overlay Settings'}
                </h1>
                {simulatorName && (
                  <span className="text-xs text-slate-400">
                    {simulatorName}
                  </span>
                )}
              </div>
              {headerProfilePicker ? (
                <HeaderProfilePicker
                  onManage={() => {
                    if (pathname === '/settings/profiles')
                      mainRef.current?.focus();
                  }}
                />
              ) : (
                currentProfile && (
                  <p className="truncate text-xs text-slate-400">
                    {currentProfile.name} Profile
                  </p>
                )
              )}
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
        {variant === 'top' && <AppNavigationBand />}
        {variant === 'contextual' && (
          <nav
            aria-label="Settings areas"
            data-area-navigation
            className="flex shrink-0 gap-6 border-b border-slate-700 px-5 py-1 [-webkit-app-region:no-drag]"
          >
            <Link
              to={appArea ? lastOverlay.current : pathname}
              aria-current={!appArea ? 'true' : undefined}
              className={`flex min-h-10 items-center gap-2 border-b-2 px-2 text-sm ${!appArea ? 'border-accent-400 text-accent-200' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <SquaresFourIcon size={18} aria-hidden="true" />
              Overlays
            </Link>
            <Link
              to={appArea ? pathname : lastApp.current}
              aria-current={appArea ? 'true' : undefined}
              className={`flex min-h-10 items-center gap-2 border-b-2 px-2 text-sm ${appArea ? 'border-accent-400 text-accent-200' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <GearIcon size={18} aria-hidden="true" />
              App settings
            </Link>
          </nav>
        )}
        <div className="flex min-h-0 flex-1">
          {/* Left Column - Widget Menu */}
          <ResearchMenu
            variant={variant}
            returnTo={lastOverlay.current}
            appTo={lastApp.current}
            profileShortcut={profileShortcut}
          />

          {/* Right Column - Widget Settings */}
          <main
            id="settings-content"
            ref={mainRef}
            tabIndex={-1}
            aria-label={
              contextual
                ? appArea
                  ? 'App settings page'
                  : 'Overlay settings page'
                : 'Settings page'
            }
            className="min-w-0 flex-1 bg-slate-900 p-4 lg:p-7"
          >
            <div className="mx-auto flex h-full max-w-[960px] flex-col overflow-hidden">
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/settings/general" replace />}
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
