import { t } from '@irdashies/frontend/i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeftIcon,
  GearIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import { useReleaseNotesStatus } from './ReleaseNotes/ReleaseNotesStatusContext';
import {
  useActiveSimulator,
  useDashboard,
  useSimWidgetSupport,
} from '@irdashies/context';
import { WIDGET_CATEGORIES, widgetDisabledMessage } from '@irdashies/types';
import {
  generalItems,
  toolItems,
  widgetItems,
  bottomItems,
  menuHasToggle,
  type MenuItem,
} from './menuItems';
import { ToggleSwitch } from './components/ToggleSwitch';

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
      if (!scroller.clientHeight) return;
      const row = link.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      if (row.top < bounds.top) scroller.scrollTop -= bounds.top - row.top;
      else if (row.bottom > bounds.bottom)
        scroller.scrollTop += row.bottom - bounds.bottom;
    };
    reveal();
    // Keep the current page visible when a restored window becomes compact.
    let lastWidth = scroller.clientWidth;
    let lastHeight = scroller.clientHeight;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            const width = scroller.clientWidth;
            const height = scroller.clientHeight;
            if (!height || (width === lastWidth && height === lastHeight))
              return;
            lastWidth = width;
            lastHeight = height;
            reveal();
          });
    observer?.observe(scroller);
    return () => observer?.disconnect();
  }, [isActive]);
  return (
    <li
      title={t(disabledReason)}
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
          <span className="block leading-5">{t(item.label)}</span>
          {disabledReason && (
            <span className="block text-xs whitespace-normal">
              {t(disabledReason)}
            </span>
          )}
        </span>
        {isNew && (
          <span className="rounded bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300">
            {t('New')}
          </span>
        )}
      </Link>
      {onToggle && (
        <ToggleSwitch
          small
          enabled={!!isEnabled}
          ariaLabel={t('Enable {label}', { label: t(item.label) })}
          onToggle={onToggle}
        />
      )}
    </li>
  );
};

export const SettingsMenu = ({
  appTo = '/settings/general',
  returnTo = '/settings/relative',
  previewMode = false,
  excludedWidgetTypes,
}: {
  appTo?: string;
  returnTo?: string;
  previewMode?: boolean;
  excludedWidgetTypes?: ReadonlySet<string>;
}) => {
  const { status: releaseNotesStatus } = useReleaseNotesStatus();
  const { pathname } = useLocation();
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const appPage = [...generalItems, ...bottomItems].some(
    (item) => item.to === pathname
  );
  const overlayPath = useRef(pathname);
  const overlayScroll = useRef<HTMLDivElement>(null);
  const appScroll = useRef<HTMLElement>(null);
  const overlayScrollPosition = useRef(0);
  const wasAppPage = useRef(appPage);
  useEffect(() => {
    if (!appPage) overlayPath.current = pathname;
  }, [appPage, pathname]);
  useLayoutEffect(() => {
    if (wasAppPage.current && !appPage && overlayScroll.current)
      overlayScroll.current.scrollTop = overlayScrollPosition.current;
    wasAppPage.current = appPage;
  }, [appPage]);
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

  const menuItems = [
    ...widgetItems.filter(
      (item) =>
        !item.hideInMenu && !excludedWidgetTypes?.has(item.widgetType ?? '')
    ),
    ...(previewMode ? [] : toolItems),
  ];
  const unsupported = (item: MenuItem) =>
    widgetDisabledMessage(supportConfig, item.widgetType, simulator);
  // Widgets the running sim cannot support are left out unless asked for.
  const supportedItems = menuItems.filter((item) => !unsupported(item));
  const hiddenCount = menuItems.length - supportedItems.length;
  const searchQuery = query.trim().toLowerCase();
  // Search and order by what the user reads, in either language.
  const visibleItems = (showHidden ? menuItems : supportedItems).filter(
    (item) =>
      t(item.label).toLowerCase().includes(searchQuery) ||
      item.label.toLowerCase().includes(searchQuery) ||
      (item.category && t(item.category).toLowerCase().includes(searchQuery)) ||
      item.category?.toLowerCase().includes(searchQuery)
  );
  const categories = [...WIDGET_CATEGORIES, 'Tools']
    .map((category) => ({
      category,
      items: visibleItems
        .filter((item) => item.category === category)
        // Widget names are listed alphabetically in the active language.
        .sort((a, b) =>
          category === 'Tools' ? 0 : t(a.label).localeCompare(t(b.label))
        ),
    }))
    .filter(({ items }) => items.length > 0);

  useLayoutEffect(() => {
    const scroller = appPage ? appScroll.current : overlayScroll.current;
    if (!scroller) return;
    // Fade only the edges with more content, including after filtering or resize.
    const updateFade = () => {
      const remaining =
        scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      scroller.style.setProperty(
        '--scroll-fade-top',
        `${Math.min(12, Math.max(0, scroller.scrollTop))}px`
      );
      scroller.style.setProperty(
        '--scroll-fade-bottom',
        `${Math.min(12, Math.max(0, remaining))}px`
      );
    };
    updateFade();
    scroller.addEventListener('scroll', updateFade, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(updateFade);
    observer?.observe(scroller);
    for (const child of scroller.children) observer?.observe(child);
    return () => {
      scroller.removeEventListener('scroll', updateFade);
      observer?.disconnect();
    };
  }, [appPage, query, showHidden, visibleItems.length]);

  return (
    <nav
      aria-label={appPage ? t('App settings pages') : t('Overlay settings')}
      className="flex w-[232px] shrink-0 flex-col border-r border-slate-700 bg-slate-950 p-3 xl:w-[252px]"
    >
      {appPage && (
        <section
          ref={appScroll}
          aria-label={t('App pages')}
          className="settings-menu-scroll min-h-0 flex-1 overflow-y-auto pb-3"
        >
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t('App settings')}
          </h2>
          <ul className="space-y-0.5">
            {[...generalItems, ...bottomItems]
              .filter((item) => !previewMode || item.path === '/general')
              .map((item) => (
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
        </section>
      )}
      <div
        hidden={appPage}
        className={appPage ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}
        data-overlay-area
      >
        <div className="shrink-0 bg-slate-950 px-1 pb-3 pt-3">
          <label className="flex min-h-9 items-center gap-2 rounded-md border border-settings-boundary bg-slate-900 px-2 text-slate-400 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-accent-400">
            <MagnifyingGlassIcon size={16} className="shrink-0" />
            <input
              type="search"
              aria-label={t('Find an overlay')}
              placeholder={t('Find an overlay')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-9 w-full min-w-0 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-400 focus-visible:outline-none!"
            />
          </label>
        </div>

        <div
          ref={overlayScroll}
          onScroll={(event) => {
            if (!appPage && event.currentTarget.clientHeight > 0)
              overlayScrollPosition.current = event.currentTarget.scrollTop;
          }}
          data-overlay-scroll
          className="settings-menu-scroll min-h-0 flex-1 overflow-y-auto"
        >
          {hiddenCount > 0 && (
            <div className="px-2 pt-2 pb-1">
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showHidden
                  ? t('(showing {hiddenCount} hidden)', { hiddenCount })
                  : t('({hiddenCount} hidden)', { hiddenCount })}
              </button>
            </div>
          )}
          <div className="space-y-4 pb-3">
            {categories.map(({ category, items }) => (
              <section key={category} aria-label={t(category)}>
                <h3 className="px-2 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {t(category)}
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <MenuLink
                      key={item.path}
                      item={item}
                      pathname={appPage ? overlayPath.current : pathname}
                      showIcon={item.category === 'Tools'}
                      isEnabled={
                        item.widgetType ? isItemEnabled(item) : undefined
                      }
                      disabledReason={t(unsupported(item)) ?? undefined}
                      onToggle={
                        canToggle(item) && item.widgetType && !unsupported(item)
                          ? setWidgetEnabled.bind(null, item.widgetType)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {visibleItems.length === 0 && (
            <p role="status" className="px-2 py-4 text-sm text-slate-400">
              {t('No overlays match “{query}”.', { query })}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 pt-1">
        <Link
          to={appPage ? returnTo : appTo}
          className="flex min-h-9 items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
        >
          {appPage ? (
            <ArrowLeftIcon size={14} aria-hidden="true" />
          ) : (
            <GearIcon size={14} aria-hidden="true" />
          )}
          {appPage ? t('Back to overlays') : t('App settings')}
        </Link>
      </div>
    </nav>
  );
};
