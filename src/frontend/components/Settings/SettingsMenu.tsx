import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useReleaseNotesStatus } from './ReleaseNotes/ReleaseNotesStatusContext';
import {
  useActiveSimulator,
  useDashboard,
  useSimWidgetSupport,
} from '@irdashies/context';
import { widgetDisabledMessage, type MenuLayout } from '@irdashies/types';
import {
  generalItems,
  widgetItems,
  bottomItems,
  WIDGET_CATEGORIES,
  menuHasToggle,
  type MenuItem,
} from './menuItems';
import { ToggleSwitch } from './components/ToggleSwitch';
import {
  addGroup,
  groupOf,
  moveWidget,
  removeGroup,
  toggleCollapsed,
} from './menuGroups';

const MenuLink = ({
  item,
  pathname,
  showIcon = false,
  isEnabled,
  onToggle,
  isNew,
  disabledReason,
  onDragStart,
  onDragEnd,
}: {
  item: MenuItem;
  pathname: string;
  showIcon?: boolean;
  isEnabled?: boolean;
  isNew?: boolean;
  /** Set for a widget the running sim cannot support: listed, dimmed, no switch. */
  disabledReason?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Present when the row controls a widget that exists in the dashboard. */
  onToggle?: (enabled: boolean) => void;
}) => {
  const isActive = pathname.startsWith(`/settings${item.path}`);
  const isWidget = !!item.widgetType;
  return (
    <li
      draggable={!!onDragStart}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.widgetType ?? '');
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
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
        draggable={false}
        className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 cursor-pointer"
      >
        {showIcon && item.icon && (
          <item.icon
            size={14}
            weight={isActive ? 'bold' : 'regular'}
            className="shrink-0"
          />
        )}
        <span className="flex-1 truncate">{item.label}</span>
        {isNew && (
          <span className="rounded bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300">
            New
          </span>
        )}
      </Link>
      {isWidget && isEnabled && !disabledReason && (
        <span className="pointer-events-none text-[10px] font-semibold tracking-widest text-emerald-400">
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
  const [showHidden, setShowHidden] = useState(false);
  const [dragging, setDragging] = useState<string>();
  const [addingGroup, setAddingGroup] = useState(false);
  const menuLayout = currentDashboard?.generalSettings?.menuLayout;
  const updateMenuLayout = (layout: MenuLayout) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      generalSettings: {
        ...currentDashboard.generalSettings,
        menuLayout: layout,
      },
    });
  };
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

  const builtInIds = WIDGET_CATEGORIES.map((c) => c.id);
  const sections = [
    ...WIDGET_CATEGORIES.map((c) => ({ ...c, custom: false })),
    ...(menuLayout?.groups ?? []).map((g) => ({ ...g, custom: true })),
  ];
  const dropOn = (groupId: string) => {
    const item = widgetItems.find((i) => i.widgetType === dragging);
    setDragging(undefined);
    if (!item?.widgetType) return;
    updateMenuLayout(
      moveWidget(
        menuLayout,
        item.widgetType,
        groupId,
        item.category ?? 'extras'
      )
    );
  };
  // Enter and Escape both blur; blur is the single place that submits, and
  // Escape empties the field first so it adds nothing.
  const submitGroup = (label: string) => {
    if (label.trim()) updateMenuLayout(addGroup(menuLayout, label));
    setAddingGroup(false);
  };

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
      {sections.map((section) => {
        const items = visibleItems.filter(
          (item) =>
            groupOf(
              item.widgetType ?? '',
              item.category ?? 'extras',
              menuLayout,
              builtInIds
            ) === section.id
        );
        // Empty built-in groups only appear as drop targets mid-drag.
        if (items.length === 0 && !section.custom && !dragging) return null;
        const onCount = items.filter(
          (item) => !unsupported(item) && isItemEnabled(item)
        ).length;
        const collapsed = !!menuLayout?.collapsed?.includes(section.id);
        return (
          <section
            key={section.id}
            className="pt-2"
            onDragOver={(e) => dragging && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(section.id);
            }}
          >
            <h4 className="flex items-center gap-2 px-2 pb-1 text-[11px] font-semibold text-slate-400 settings-heading tracking-widest">
              <button
                type="button"
                aria-expanded={!collapsed}
                onClick={() =>
                  updateMenuLayout(toggleCollapsed(menuLayout, section.id))
                }
                className="flex items-center gap-1 cursor-pointer hover:text-white"
              >
                <span aria-hidden>{collapsed ? '▸' : '▾'}</span>
                {section.label}
              </button>
              <span className="flex-1 border-t border-dashed border-slate-600" />
              {section.custom && (
                <button
                  type="button"
                  aria-label={`Delete group ${section.label}`}
                  onClick={() =>
                    updateMenuLayout(removeGroup(menuLayout, section.id))
                  }
                  className="text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              )}
              <span className="text-slate-500">
                {onCount}/{items.length}
              </span>
            </h4>
            {!collapsed && (
              <ul className="flex flex-col min-h-2">
                {items.map((item) => (
                  <MenuLink
                    key={item.path}
                    item={item}
                    pathname={pathname}
                    isEnabled={
                      item.widgetType ? isItemEnabled(item) : undefined
                    }
                    disabledReason={unsupported(item) ?? undefined}
                    onDragStart={
                      item.widgetType
                        ? () => setDragging(item.widgetType)
                        : undefined
                    }
                    onDragEnd={() => setDragging(undefined)}
                    onToggle={
                      canToggle(item) && item.widgetType && !unsupported(item)
                        ? setWidgetEnabled.bind(null, item.widgetType)
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <div className="px-2 pt-2">
        {!addingGroup ? (
          <button
            type="button"
            onClick={() => setAddingGroup(true)}
            className="text-xs text-slate-500 hover:text-white cursor-pointer"
          >
            + New group
          </button>
        ) : (
          <input
            autoFocus
            placeholder="Group name"
            aria-label="New group name"
            onBlur={(e) => submitGroup(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.currentTarget.value = '';
              if (e.key === 'Enter' || e.key === 'Escape')
                e.currentTarget.blur();
            }}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          />
        )}
      </div>

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
