import { useState } from 'react';
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
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  return (
    <li
      title={disabledReason}
      className={[
        'flex items-center gap-2 pr-2 rounded border-l-2 select-none transition-colors',
        disabledReason ? 'opacity-50' : '',
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
        <span className="flex-1 min-w-0">
          <span className="block truncate">{item.label}</span>
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

export const SettingsMenu = () => {
  const { status: releaseNotesStatus } = useReleaseNotesStatus();
  const { pathname } = useLocation();
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  const [showHidden, setShowHidden] = useState(false);
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
  const visibleItems = showHidden ? menuItems : supportedItems;
  const enabledCount = supportedItems.filter(isItemEnabled).length;

  return (
    <div className="w-1/4 bg-slate-800 p-3 rounded-md border border-slate-600/60 flex flex-col gap-0 overflow-y-auto">
      <ul className="flex flex-col pb-2 border-b border-slate-700">
        {generalItems.map((item) => (
          <MenuLink key={item.path} item={item} pathname={pathname} showIcon />
        ))}
      </ul>

      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <p className="text-xs font-semibold text-slate-400 tracking-widest">
          Widgets
        </p>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="text-xs text-slate-600 hover:text-slate-300 cursor-pointer"
          >
            {showHidden
              ? `(showing ${hiddenCount} hidden)`
              : `(${hiddenCount} hidden)`}
          </button>
        )}
        <span className="flex-1 mx-2 border-t border-dashed border-accent-500/60" />
        <span className="text-xs text-slate-500">{enabledCount} on</span>
      </div>
      <ul className="flex flex-col pb-2">
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
