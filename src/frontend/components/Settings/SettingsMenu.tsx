import { Link, useLocation } from 'react-router-dom';
import { useReleaseNotesStatus } from './ReleaseNotes/ReleaseNotesStatusContext';
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
  WIDGET_CATEGORIES,
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
}: {
  item: MenuItem;
  pathname: string;
  showIcon?: boolean;
  isEnabled?: boolean;
  isNew?: boolean;
  /** Present when the row controls a widget that exists in the dashboard. */
  onToggle?: (enabled: boolean) => void;
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  const isWidget = !!item.widgetType;
  return (
    <li
      className={[
        'flex items-center gap-2 pr-2 rounded border-l-2 transition-colors',
        isActive
          ? 'border-accent-500 bg-accent-500/10 text-white'
          : 'border-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white',
      ].join(' ')}
    >
      <Link
        to={item.to}
        className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 cursor-pointer"
      >
        {showIcon && item.icon && (
          <item.icon
            size={14}
            weight={isActive ? 'bold' : 'regular'}
            className="shrink-0"
          />
        )}
        {item.description ? (
          <span className="flex-1 min-w-0 flex flex-col leading-tight">
            <span className="truncate settings-heading font-semibold text-[13px]">
              {item.label}
            </span>
            <span className="truncate text-[11px] text-slate-500">
              {item.description}
            </span>
          </span>
        ) : (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {isNew && (
          <span className="rounded bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300">
            New
          </span>
        )}
      </Link>
      {isWidget && isEnabled && (
        <span className="text-[10px] font-semibold tracking-widest text-emerald-400">
          LIVE
        </span>
      )}
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

export const SettingsMenu = () => {
  const { status: releaseNotesStatus } = useReleaseNotesStatus();
  const { pathname } = useLocation();
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  // The primary widget (id === type) is the one the switch toggles, so show its
  // state; fall back to an instance only when there is no primary.
  const isWidgetEnabled = (widgetType: string) => {
    const widgets = currentDashboard?.widgets ?? [];
    const widget =
      widgets.find((w) => w.id === widgetType) ??
      widgets.find((w) => (w.type ?? w.id) === widgetType);
    return widget?.enabled ?? false;
  };

  // The settings page toggles the widget whose id is the widget type, so the
  // menu does the same; extra instances keep their own state. Grouped items
  // share a page and have no single widget to switch.
  const widgetIds = currentDashboard?.widgets.map((w) => w.id) ?? [];
  const canToggle = (item: MenuItem) =>
    !!item.widgetType && menuHasToggle(item.widgetType, widgetIds);

  const setWidgetEnabled = (widgetType: string, enabled: boolean) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        w.id === widgetType ? { ...w, enabled } : w
      ),
    });
  };

  // A grouped item is on while any widget sharing its page is.
  const isItemEnabled = (item: MenuItem) =>
    !!item.widgetType &&
    (item.groupTypes ?? [item.widgetType]).some(isWidgetEnabled);

  const menuItems = widgetItems.filter((item) => !item.hideInMenu);
  // Widgets the running sim cannot support are left out of the menu.
  const visibleItems = menuItems.filter(
    (item) => !widgetDisabledMessage(supportConfig, item.widgetType, simulator)
  );
  const hiddenCount = menuItems.length - visibleItems.length;
  const enabledCount = visibleItems.filter(isItemEnabled).length;

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md border border-slate-600/60 flex flex-col gap-0 overflow-y-auto">
      <ul className="flex flex-col pb-2 border-b border-slate-700">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>

      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <p className="text-xs font-semibold text-slate-400 settings-heading tracking-widest">
          Widgets
        </p>
        {hiddenCount > 0 && (
          <span className="text-xs text-slate-600">({hiddenCount} hidden)</span>
        )}
        <span className="flex-1 mx-2 border-t border-dashed border-accent-500/60" />
        <span className="text-xs text-slate-500">{enabledCount} on</span>
      </div>
      {WIDGET_CATEGORIES.map((category) => {
        const items = visibleItems.filter(
          (item) => (item.category ?? 'extras') === category.id
        );
        if (items.length === 0) return null;
        const onCount = items.filter(isItemEnabled).length;
        return (
          <section key={category.id} className="pt-2">
            <h4 className="flex items-center gap-2 px-2 pb-1 text-[11px] font-semibold text-slate-400 settings-heading tracking-widest">
              {category.label}
              <span className="flex-1 border-t border-dashed border-slate-600" />
              <span className="text-slate-500">
                {onCount}/{items.length}
              </span>
            </h4>
            <ul className="flex flex-col">
              {items.map((item) => (
                <MenuLink
                  key={item.path}
                  item={item}
                  pathname={pathname}
                  isEnabled={item.widgetType ? isItemEnabled(item) : undefined}
                  onToggle={
                    canToggle(item) && item.widgetType
                      ? setWidgetEnabled.bind(null, item.widgetType)
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}

      <ul className="mt-auto pt-2 border-t border-slate-700 flex flex-col">
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
    </div>
  );
};
