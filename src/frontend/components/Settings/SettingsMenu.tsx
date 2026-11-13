import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeftIcon,
  GearIcon,
  MagnifyingGlassIcon,
  ToolboxIcon,
} from '@phosphor-icons/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { settingsPageKind, type SettingsPageKind } from './settingsPageKind';
import { ToggleSwitch } from './components/ToggleSwitch';
import { MenuSortControl } from './components/MenuSortControl';
import {
  MENU_SORT_LABELS,
  readMenuSort,
  saveMenuSort,
  sortMenuItems,
  type MenuSortMode,
} from './menuSort';

/** Whether the row is the current one: its page, or a layout copy's of it. */
const isMenuItemActive = (item: MenuItem, pathname: string) =>
  pathname.startsWith(`/settings${item.path}`);

const MenuLink = ({
  item,
  pathname,
  showIcon = false,
  isEnabled,
  onToggle,
  isNew,
  disabledReason,
  onNavigate,
  revealKey,
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
  /**
   * A change brings the current row back into view: the list was reordered
   * under it (a new sort order, or a switch moving it to the other group in
   * Activated first), which keeps the row mounted and its scroll stale.
   */
  revealKey?: string;
}) => {
  const isActive = isMenuItemActive(item, pathname);
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
  }, [isActive, revealKey]);
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

const NAV_LABELS: Record<SettingsPageKind, string> = {
  app: 'App settings pages',
  tool: 'Tools pages',
  overlay: 'Overlay settings',
};

export const SettingsMenu = ({
  appTo = '/settings/general',
  toolsTo = '/settings/profiles',
  returnTo = '/settings/relative',
  previewMode = false,
  excludedWidgetTypes,
}: {
  appTo?: string;
  /** Where the Tools link goes: the tool page visited last. */
  toolsTo?: string;
  returnTo?: string;
  previewMode?: boolean;
  excludedWidgetTypes?: ReadonlySet<string>;
}) => {
  const { status: releaseNotesStatus } = useReleaseNotesStatus();
  // Without a trailing slash: TrailingSlashRedirect at the route sees to it.
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  // The order chosen last time, so the list comes back as it was left.
  const [sortMode, setSortMode] = useState<MenuSortMode>(readMenuSort);
  const changeSortMode = (mode: MenuSortMode) => {
    setSortMode(mode);
    saveMenuSort(mode);
  };
  // Tools are pages of their own, not overlays: like App settings, they
  // have a menu that takes the overlay list's place. The preview has none.
  const kind = settingsPageKind(pathname);
  const pageKind: SettingsPageKind =
    previewMode && kind === 'tool' ? 'overlay' : kind;
  const appPage = pageKind === 'app';
  const toolPage = pageKind === 'tool';
  const asidePage = appPage || toolPage;
  const overlayPath = useRef(pathname);
  const overlayScroll = useRef<HTMLDivElement>(null);
  const asideScroll = useRef<HTMLElement>(null);
  const overlayScrollPosition = useRef(0);
  const wasAsidePage = useRef(asidePage);
  useEffect(() => {
    if (!asidePage) overlayPath.current = pathname;
  }, [asidePage, pathname]);
  useLayoutEffect(() => {
    if (wasAsidePage.current && !asidePage && overlayScroll.current)
      overlayScroll.current.scrollTop = overlayScrollPosition.current;
    wasAsidePage.current = asidePage;
  }, [asidePage]);
  // Layout-editor copies of a widget share its menu entry: it is on while any
  // copy is, so a custom layout cannot hide behind a switched-off default.
  // Built once per render: the list asks for every row, several times over.
  const enabledTypes = new Set(
    (currentDashboard?.widgets ?? [])
      .filter((w) => w.enabled)
      .map((w) => w.type ?? w.id)
  );
  const isWidgetEnabled = (widgetType: string) => enabledTypes.has(widgetType);

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

  // Switching an overlay on opens its settings, to set it up straight away.
  // Switching one off leaves the page shown as it is, and so does switching
  // on the row already current (a layout copy's page shows its type's row).
  const toggleWidget =
    (item: MenuItem, widgetType: string) => (enabled: boolean) => {
      setWidgetEnabled(widgetType, enabled);
      if (enabled && !isMenuItemActive(item, pathname)) navigate(item.to);
    };

  // A grouped item is on while any widget sharing its page is.
  const isItemEnabled = (item: MenuItem) =>
    !!item.widgetType &&
    (item.groupTypes ?? [item.widgetType]).some(isWidgetEnabled);

  const menuItems = widgetItems.filter(
    (item) =>
      !item.hideInMenu && !excludedWidgetTypes?.has(item.widgetType ?? '')
  );
  const unsupported = (item: MenuItem) =>
    widgetDisabledMessage(supportConfig, item.widgetType, simulator);
  // Widgets the running sim cannot support are left out unless asked for.
  const supportedItems = menuItems.filter((item) => !unsupported(item));
  const hiddenCount = menuItems.length - supportedItems.length;
  const searchQuery = query.trim().toLowerCase();
  const visibleItems = (showHidden ? menuItems : supportedItems).filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery) ||
      item.category?.toLowerCase().includes(searchQuery)
  );
  const categories = [...WIDGET_CATEGORIES]
    .map((category) => ({
      category,
      items: visibleItems.filter((item) => item.category === category),
    }))
    .filter(({ items }) => items.length > 0);
  // Without categories: one list, alphanumeric or activated first.
  const sortedItems =
    sortMode === 'category'
      ? []
      : sortMenuItems(visibleItems, sortMode, isItemEnabled);

  // What moves the current row: a new order, or in Activated first its
  // switch. A change re-runs its reveal; other rows ignore it. Searching, or
  // another overlay turned on by a dashboard update, leaves it and the
  // scroll alone. Switching another overlay on here opens that one instead.
  const renderLink = (item: MenuItem) => (
    <MenuLink
      key={item.path}
      item={item}
      pathname={asidePage ? overlayPath.current : pathname}
      revealKey={`${sortMode}:${isItemEnabled(item)}`}
      isEnabled={item.widgetType ? isItemEnabled(item) : undefined}
      disabledReason={unsupported(item) ?? undefined}
      onToggle={
        canToggle(item) && item.widgetType && !unsupported(item)
          ? toggleWidget(item, item.widgetType)
          : undefined
      }
    />
  );

  useLayoutEffect(() => {
    const scroller = asidePage ? asideScroll.current : overlayScroll.current;
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
  }, [asidePage, pageKind, query, showHidden, visibleItems.length, sortMode]);

  return (
    <nav
      aria-label={NAV_LABELS[pageKind]}
      className="flex w-[232px] shrink-0 flex-col border-r border-slate-700 bg-slate-950 p-3 xl:w-[252px]"
    >
      {appPage && (
        <section
          ref={asideScroll}
          aria-label="App pages"
          className="settings-menu-scroll min-h-0 flex-1 overflow-y-auto pb-3"
        >
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            App settings
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
      {toolPage && (
        <section
          ref={asideScroll}
          aria-label="Tool pages"
          className="settings-menu-scroll min-h-0 flex-1 overflow-y-auto pb-3"
        >
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Tools
          </h2>
          <ul className="space-y-0.5">
            {toolItems.map((item) => (
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
        hidden={asidePage}
        className={asidePage ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}
        data-overlay-area
      >
        <div className="flex shrink-0 items-center gap-1.5 bg-slate-950 px-1 pb-3 pt-3">
          <label className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-settings-boundary bg-slate-900 px-2 text-slate-400 focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-accent-400">
            <MagnifyingGlassIcon size={16} className="shrink-0" />
            <input
              type="search"
              aria-label="Find an overlay"
              placeholder="Find an overlay"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-9 w-full min-w-0 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-400 focus-visible:outline-none!"
            />
          </label>
          <MenuSortControl mode={sortMode} onChange={changeSortMode} />
        </div>

        <div
          ref={overlayScroll}
          onScroll={(event) => {
            if (!asidePage && event.currentTarget.clientHeight > 0)
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
                  ? `(showing ${hiddenCount} hidden)`
                  : `(${hiddenCount} hidden)`}
              </button>
            </div>
          )}
          {sortMode === 'category' ? (
            <div className="space-y-4 pb-3">
              {categories.map(({ category, items }) => (
                <section key={category} aria-label={category}>
                  <h3 className="px-2 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {category}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {items.map(renderLink)}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            sortedItems.length > 0 && (
              <ul
                aria-label={`Overlays, ${MENU_SORT_LABELS[sortMode].toLowerCase()}`}
                className="flex flex-col gap-0.5 pt-2 pb-3"
              >
                {sortedItems.map(renderLink)}
              </ul>
            )
          )}
          {visibleItems.length === 0 && (
            <p role="status" className="px-2 py-4 text-sm text-slate-400">
              No overlays match “{query}”.
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 space-y-0.5 pt-1">
        {!asidePage && !previewMode && (
          <Link
            to={toolsTo}
            className="flex min-h-9 items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
          >
            <ToolboxIcon size={14} aria-hidden="true" />
            Tools
          </Link>
        )}
        <Link
          to={asidePage ? returnTo : appTo}
          className="flex min-h-9 items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
        >
          {asidePage ? (
            <ArrowLeftIcon size={14} aria-hidden="true" />
          ) : (
            <GearIcon size={14} aria-hidden="true" />
          )}
          {asidePage ? 'Back to overlays' : 'App settings'}
        </Link>
      </div>
    </nav>
  );
};
