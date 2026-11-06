import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftIcon,
  GearIcon,
  MagnifyingGlassIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import { useReleaseNotesStatus } from '../ReleaseNotes/ReleaseNotesStatusContext';
import {
  useActiveSimulator,
  useDashboard,
  useSimWidgetSupport,
} from '@irdashies/context';
import { widgetDisabledMessage } from '@irdashies/types';
import {
  generalItems,
  widgetItems,
  bottomItems,
  menuHasToggle,
  type MenuItem,
} from '../menuItems';
import { ToggleSwitch } from '../components/ToggleSwitch';

const MenuLink = ({
  item,
  pathname,
  showIcon = false,
  isEnabled,
  onToggle,
  isNew,
  disabledReason,
  onNavigate,
}: {
  item: MenuItem;
  pathname: string;
  showIcon?: boolean;
  isEnabled?: boolean;
  isNew?: boolean;
  /** Set for a widget the running sim cannot support: listed, dimmed, no switch. */
  disabledReason?: string;
  /** Present when the row controls a widget that exists in the dashboard. */
  onToggle?: (enabled: boolean) => void;
  onNavigate?: () => void;
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = linkRef.current;
    const scroller = link?.closest<HTMLElement>('[data-overlay-scroll]');
    if (!isActive || !link || !scroller) return;
    const reveal = () => {
      const row = link.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      if (row.top < bounds.top) scroller.scrollTop -= bounds.top - row.top;
      else if (row.bottom > bounds.bottom)
        scroller.scrollTop += row.bottom - bounds.bottom;
    };
    reveal();
    // Keep the current page visible when a restored window becomes compact.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(reveal);
    observer?.observe(scroller);
    return () => observer?.disconnect();
  }, [isActive]);
  return (
    <li
      title={disabledReason}
      className={[
        'flex items-center gap-2 pr-2 rounded-md border-l-2 select-none transition-colors',
        disabledReason ? 'opacity-50' : '',
        isActive
          ? 'border-accent-400 bg-accent-400/10 text-accent-200'
          : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white',
      ].join(' ')}
    >
      <Link
        ref={linkRef}
        to={item.to}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        draggable={false}
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm cursor-pointer"
      >
        {showIcon && item.icon && (
          <item.icon
            size={14}
            weight={isActive ? 'bold' : 'regular'}
            className="shrink-0"
          />
        )}
        <span className="flex-1 min-w-0">
          <span className="block leading-5">{item.label}</span>
          {disabledReason && (
            <span className="block text-xs whitespace-normal">
              {disabledReason}
            </span>
          )}
        </span>
        {isNew && (
          <span className="rounded bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300">
            New
          </span>
        )}
      </Link>
      {onToggle && (
        <ToggleSwitch
          small
          enabled={!!isEnabled}
          ariaLabel={`Enable ${item.label}`}
          onToggle={onToggle}
        />
      )}
    </li>
  );
};

export type NavigationVariant =
  'grouped' | 'split' | 'top' | 'contextual' | 'dedicated';

// Research-only fork of the current menu. Never imported by production.
export const ResearchMenu = ({
  variant,
  returnTo = '/settings/relative',
  appTo = '/settings/general',
  profileShortcut = false,
}: {
  variant: NavigationVariant;
  returnTo?: string;
  appTo?: string;
  profileShortcut?: boolean;
}) => {
  const { status: releaseNotesStatus } = useReleaseNotesStatus();
  const { pathname } = useLocation();
  const { currentDashboard, currentProfile, onDashboardUpdated } =
    useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const appPage = generalItems.some((item) => pathname === item.to);
  const overlayPage = widgetItems.some((item) => pathname === item.to);
  const contextual = variant === 'contextual' || variant === 'dedicated';
  const appArea = [...generalItems, ...bottomItems].some(
    (item) => pathname === item.to
  );
  const profilesItem = generalItems.find((item) => item.path === '/profiles');
  const lastApp = useRef('/settings/general');
  const lastOverlay = useRef('/settings/relative');
  useEffect(() => {
    if (appPage) lastApp.current = pathname;
    else if (widgetItems.some((item) => item.to === pathname))
      lastOverlay.current = pathname;
  }, [appPage, pathname]);
  const showApp =
    variant === 'grouped' ||
    (variant === 'split' && appPage) ||
    (contextual && appArea);
  const showOverlays = contextual ? !appArea : variant !== 'split' || !appPage;
  // Layout-editor copies of a widget share its menu entry: it is on while any
  // copy is, so a custom layout cannot hide behind a switched-off default.
  const instancesOf = (widgetType: string) =>
    (currentDashboard?.widgets ?? []).filter(
      (w) => (w.type ?? w.id) === widgetType
    );
  const isWidgetEnabled = (widgetType: string) =>
    instancesOf(widgetType).some((w) => w.enabled);

  // The settings page toggles the widget whose id is the widget type, so the
  // menu does the same; extra instances keep their own state. Grouped items
  // share a page and have no single widget to switch.
  const widgetIds = currentDashboard?.widgets.map((w) => w.id) ?? [];
  const canToggle = (item: MenuItem) =>
    !!item.widgetType && menuHasToggle(item.widgetType, widgetIds);

  // Off switches every copy off; on revives only the primary widget.
  const setWidgetEnabled = (widgetType: string, enabled: boolean) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        (enabled ? w.id === widgetType : (w.type ?? w.id) === widgetType)
          ? { ...w, enabled }
          : w
      ),
    });
  };

  // A grouped item is on while any widget sharing its page is.
  const isItemEnabled = (item: MenuItem) =>
    !!item.widgetType &&
    (item.groupTypes ?? [item.widgetType]).some(isWidgetEnabled);

  const menuItems = widgetItems.filter((item) => !item.hideInMenu);
  const unsupported = (item: MenuItem) =>
    widgetDisabledMessage(supportConfig, item.widgetType, simulator);
  // Widgets the running sim cannot support are left out unless asked for.
  const supportedItems = menuItems.filter((item) => !unsupported(item));
  const hiddenCount = menuItems.length - supportedItems.length;
  const visibleItems = (showHidden ? menuItems : supportedItems).filter(
    (item) => item.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <nav
      aria-label={
        contextual
          ? appArea
            ? 'App settings pages'
            : 'Overlay settings'
          : 'Settings navigation'
      }
      className="flex w-[232px] shrink-0 flex-col border-r border-slate-700 bg-slate-950 p-3 xl:w-[252px]"
    >
      {variant === 'split' && (
        <div
          className="mb-3 flex shrink-0 gap-1 border-b border-slate-700 pb-3"
          aria-label="Settings areas"
        >
          <Link
            to={appPage ? pathname : lastApp.current}
            aria-current={appPage ? 'true' : undefined}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-md border px-2 text-sm ${appPage ? 'border-accent-400 bg-accent-400/10 text-accent-200' : 'border-settings-boundary text-slate-300'}`}
          >
            App
          </Link>
          <Link
            to={overlayPage ? pathname : lastOverlay.current}
            aria-current={overlayPage ? 'true' : undefined}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-md border px-2 text-sm ${overlayPage ? 'border-accent-400 bg-accent-400/10 text-accent-200' : 'border-settings-boundary text-slate-300'}`}
          >
            Overlays
          </Link>
        </div>
      )}
      {variant === 'dedicated' &&
        profileShortcut &&
        !appArea &&
        profilesItem && (
          <div className="shrink-0 pb-3">
            <Link
              to={profilesItem.to}
              aria-label={profilesItem.label}
              aria-describedby="research-profile-context"
              className="flex min-h-14 items-center gap-3 rounded-md border border-settings-boundary bg-settings-control px-3 py-2 text-slate-200 hover:bg-settings-hover"
            >
              <UsersIcon size={20} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {profilesItem.label}
                </span>
                <span
                  id="research-profile-context"
                  className="block break-words text-xs text-slate-400"
                >
                  {currentProfile
                    ? `Current: ${currentProfile.name}`
                    : 'Manage profiles'}
                </span>
              </span>
            </Link>
          </div>
        )}
      {variant === 'dedicated' && appArea && (
        <Link
          to={returnTo}
          className="mb-3 flex min-h-9 shrink-0 items-center gap-2 border-b border-slate-700 px-2 pb-3 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeftIcon size={16} aria-hidden="true" />
          Back to overlays
        </Link>
      )}
      {showApp && (
        <section
          className={
            contextual ? 'min-h-0 flex-1 overflow-y-auto pb-3' : 'shrink-0 pb-3'
          }
          aria-label="App pages"
        >
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {contextual ? 'App settings' : 'App'}
          </h2>
          <ul className="space-y-0.5">
            {generalItems.map((item) => (
              <MenuLink
                key={item.path}
                item={item}
                pathname={pathname}
                showIcon
              />
            ))}
          </ul>
        </section>
      )}
      <div
        hidden={!showOverlays}
        className={showOverlays ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        data-overlay-area
      >
        <div className="shrink-0 space-y-2 border-t border-slate-700 bg-slate-950 px-1 pb-3 pt-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Overlays
            </h2>
          </div>
          <label className="flex min-h-9 items-center gap-2 rounded-md border border-settings-boundary bg-slate-900 px-2 text-slate-400 focus-within:border-accent-400">
            <MagnifyingGlassIcon size={16} className="shrink-0" />
            <input
              type="search"
              aria-label="Find an overlay"
              placeholder="Find an overlay"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-9 w-full min-w-0 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div
          data-overlay-scroll
          className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
        >
          {hiddenCount > 0 && (
            <div className="px-2 pt-2 pb-1">
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showHidden
                  ? `(showing ${hiddenCount} hidden)`
                  : `(${hiddenCount} hidden)`}
              </button>
            </div>
          )}
          <ul className="flex flex-col gap-0.5 pb-3">
            {visibleItems.map((item) => (
              <MenuLink
                key={item.path}
                item={item}
                pathname={pathname}
                isEnabled={item.widgetType ? isItemEnabled(item) : undefined}
                disabledReason={unsupported(item) ?? undefined}
                onToggle={
                  canToggle(item) && item.widgetType && !unsupported(item)
                    ? setWidgetEnabled.bind(null, item.widgetType)
                    : undefined
                }
              />
            ))}
          </ul>
          {visibleItems.length === 0 && (
            <p role="status" className="px-2 py-4 text-sm text-slate-400">
              No overlays match “{query}”.
            </p>
          )}
        </div>
      </div>
      {!showOverlays && !contextual && <div className="min-h-0 flex-1" />}
      {variant === 'dedicated' && !appArea && (
        <div className="mt-2 shrink-0 border-t border-slate-700 pt-3">
          <Link
            to={appTo}
            className="flex min-h-11 items-center gap-3 rounded-md border border-settings-boundary bg-settings-control px-3 py-2 text-sm font-medium text-slate-200 hover:bg-settings-hover"
          >
            <GearIcon size={20} aria-hidden="true" />
            App settings
          </Link>
        </div>
      )}
      {(!contextual || appArea) && (
        <ul className="mt-2 flex shrink-0 flex-col gap-0.5 border-t border-slate-700 pt-2">
          {bottomItems.map((item) => (
            <MenuLink
              key={item.path}
              item={item}
              pathname={pathname}
              showIcon
              isNew={
                item.path === '/release-notes' &&
                !!releaseNotesStatus?.unreadVersion
              }
            />
          ))}
        </ul>
      )}
    </nav>
  );
};

export const AppNavigationBand = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="App pages"
      data-app-band
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-700 bg-slate-950 px-4 py-1.5"
    >
      <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        App
      </h2>
      <ul className="flex flex-wrap gap-1">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>
    </nav>
  );
};
