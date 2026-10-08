import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import {
  useActiveSimulator,
  useDashboard,
  useSimWidgetSupport,
} from '@irdashies/context';
import {
  SIMULATOR_IDS,
  SIMULATOR_LABELS,
  isWidgetVisibleInGameFilter,
  widgetDisabledMessage,
  type WidgetGameFilter,
} from '@irdashies/types';
import {
  generalItems,
  widgetItems,
  bottomItems,
  type MenuItem,
} from './menuItems';

const GAME_FILTERS: { value: WidgetGameFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...SIMULATOR_IDS.map((id) => ({ value: id, label: SIMULATOR_LABELS[id] })),
];

const FILTER_PANEL_CLASS: Record<WidgetGameFilter, string> = {
  all: 'bg-slate-700/60 border-slate-500/40',
  iracing: 'bg-blue-900/30 border-blue-500/40',
  lmu: 'bg-orange-900/30 border-orange-500/40',
};

const MenuLink = ({
  item,
  pathname,
  showIcon = false,
  isEnabled,
  disabledReason,
}: {
  item: MenuItem;
  pathname: string;
  showIcon?: boolean;
  isEnabled?: boolean;
  /** Hover text when the running sim cannot support this widget. */
  disabledReason?: string | null;
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  // Still a link: the settings page stays reachable so the user can see why it
  // is unavailable and what it would do.
  return (
    <li>
      <Link
        to={item.to}
        title={disabledReason ?? undefined}
        className={[
          'flex items-center gap-2 w-full px-2 py-1 rounded cursor-pointer border-l-2 transition-colors',
          isActive
            ? 'border-blue-400 bg-slate-700 text-white'
            : disabledReason
              ? 'border-transparent text-slate-600 hover:bg-slate-700/50'
              : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white',
        ].join(' ')}
      >
        {showIcon && item.icon && (
          <item.icon
            size={14}
            weight={isActive ? 'bold' : 'regular'}
            className="shrink-0"
          />
        )}
        <span className="flex-1">{item.label}</span>
        {isEnabled && !disabledReason && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
        )}
      </Link>
    </li>
  );
};

export const SettingsMenu = () => {
  const { pathname } = useLocation();
  const { currentDashboard } = useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  // Compatible-only by default: the full list is mostly noise when half of it
  // cannot run in the sim you are using. Persisted in config.json, so the
  // choice survives a restart.
  const [showAllWidgets, setShowAllWidgets] = useState(false);
  const [gameFilter, setGameFilter] = useState<WidgetGameFilter>('all');

  useEffect(() => {
    let cancelled = false;
    void window.dashboardBridge
      ?.getSettingsShowAllWidgets?.()
      .then((stored) => {
        if (!cancelled) setShowAllWidgets(stored);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleShowAllWidgets = () => {
    setShowAllWidgets((previous) => {
      const next = !previous;
      void window.dashboardBridge?.setSettingsShowAllWidgets?.(next);
      return next;
    });
  };

  const isWidgetEnabled = (widgetType: string) => {
    const widget = currentDashboard?.widgets.find(
      (w) => (w.type ?? w.id) === widgetType
    );
    return widget?.enabled ?? false;
  };

  const itemsWithSupport = widgetItems.map((item) => ({
    item,
    disabledReason: widgetDisabledMessage(
      supportConfig,
      item.widgetType,
      simulator
    ),
  }));
  const runningSimItems = showAllWidgets
    ? itemsWithSupport
    : itemsWithSupport.filter(({ disabledReason }) => !disabledReason);
  const hiddenCount = itemsWithSupport.length - runningSimItems.length;
  const visibleItems =
    gameFilter === 'all'
      ? runningSimItems
      : itemsWithSupport.filter(({ item }) =>
          isWidgetVisibleInGameFilter(
            supportConfig,
            item.widgetType,
            gameFilter
          )
        );

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md flex flex-col gap-0 overflow-y-auto">
      <ul className="flex flex-col pb-2 border-b border-slate-700">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>

      <div
        className={`mt-2 rounded border p-2 ${FILTER_PANEL_CLASS[gameFilter]}`}
      >
        <label
          htmlFor="widget-game-filter"
          className="mb-1 block text-xs font-medium text-slate-200"
        >
          Show widgets for
        </label>
        <select
          id="widget-game-filter"
          value={gameFilter}
          onChange={(event) =>
            setGameFilter(event.target.value as WidgetGameFilter)
          }
          className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-sm"
        >
          {GAME_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={toggleShowAllWidgets}
          title={
            showAllWidgets
              ? 'Showing every widget. Click to show only the ones this simulator supports.'
              : 'Showing only the widgets this simulator supports. Click to show every widget.'
          }
          aria-pressed={showAllWidgets}
          className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showAllWidgets ? <EyeIcon size={14} /> : <EyeSlashIcon size={14} />}
        </button>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Widgets
        </p>
        {!showAllWidgets && hiddenCount > 0 && (
          <span className="text-xs text-slate-600">({hiddenCount} hidden)</span>
        )}
      </div>
      {visibleItems.length === 0 ? (
        <p className="px-2 py-1 text-xs text-slate-500">
          No widgets match this filter.
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibleItems.map(({ item, disabledReason }) => (
            <MenuLink
              key={item.path}
              item={item}
              pathname={pathname}
              disabledReason={disabledReason}
              isEnabled={
                item.widgetType ? isWidgetEnabled(item.widgetType) : undefined
              }
            />
          ))}
        </ul>
      )}

      <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col">
        {bottomItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>
    </div>
  );
};
