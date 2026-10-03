import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
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
  type MenuItem,
} from './menuItems';

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
  const visibleItems = showAllWidgets
    ? itemsWithSupport
    : itemsWithSupport.filter(({ disabledReason }) => !disabledReason);
  const hiddenCount = itemsWithSupport.length - visibleItems.length;

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md flex flex-col gap-0 overflow-y-auto">
      <ul className="flex flex-col pb-2 border-b border-slate-700">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>

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

      <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col">
        {bottomItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>
    </div>
  );
};
