import { memo } from 'react';
import {
  CaretDownIcon,
  CaretRightIcon,
  GearIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import {
  GANTRY_DOCK_PANEL_LABELS,
  type ResolvedDockPanel,
} from '@irdashies/types';
import { getWidget } from '../../../WidgetIndex';
import { WidgetRuntimeProvider } from '../../../widgetRuntime';
import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';

const widgetType = (resolved: ResolvedDockPanel) =>
  resolved.status === 'ready'
    ? resolved.widget.type || resolved.widget.id
    : resolved.panel.type;

/** The settings page the gear button opens. */
export const dockPanelSettingsTarget = (resolved: ResolvedDockPanel) =>
  resolved.status === 'ready' ? resolved.widget.id : 'gantry';

export const dockPanelLabel = (resolved: ResolvedDockPanel) =>
  GANTRY_DOCK_PANEL_LABELS[resolved.panel.type];

const iconButtonClass =
  'p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors';

interface DockPanelHeaderProps {
  panelId: string;
  label: string;
  settingsTarget: string;
  collapsed: boolean;
  onToggleCollapsed: (panelId: string) => void;
  onOpenSettings: (target: string) => void;
}

export const DockPanelHeader = memo(
  ({
    panelId,
    label,
    settingsTarget,
    collapsed,
    onToggleCollapsed,
    onOpenSettings,
  }: DockPanelHeaderProps) => (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-800/60 border-b border-slate-700/50 flex-shrink-0">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
        {label}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        className={iconButtonClass}
        title={`Open ${label} settings`}
        aria-label={`Open ${label} settings`}
        onClick={() => onOpenSettings(settingsTarget)}
      >
        <GearIcon size={14} />
      </button>
      <button
        type="button"
        className={iconButtonClass}
        title={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        aria-expanded={!collapsed}
        onClick={() => onToggleCollapsed(panelId)}
      >
        {collapsed ? <CaretRightIcon size={14} /> : <CaretDownIcon size={14} />}
      </button>
    </div>
  )
);
DockPanelHeader.displayName = 'DockPanelHeader';

const PanelMessage = ({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) => (
  <div className="h-full flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-400">
    <WarningIcon size={18} className="text-slate-500" />
    <p>{message}</p>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="text-sky-400 hover:text-sky-300 underline"
      >
        {action.label}
      </button>
    )}
  </div>
);

const PANEL_ERROR = (
  <PanelMessage message="This panel hit a problem. It will try again shortly." />
);

interface DockPanelContentProps {
  resolved: ResolvedDockPanel;
  running: boolean;
  onOpenSettings: (target: string) => void;
}

/**
 * Renders the widget the way the overlay does: through the registry, inside
 * its own error boundary and its own channel rates.
 */
export const DockPanelContent = memo(
  ({ resolved, running, onOpenSettings }: DockPanelContentProps) => {
    if (resolved.status !== 'ready') {
      const message =
        resolved.status === 'unlinked'
          ? 'Choose which fuel layout this panel shows.'
          : resolved.panel.type === 'fuel'
            ? 'The fuel layout this panel used was removed.'
            : `The ${dockPanelLabel(resolved)} widget is missing from this profile.`;
      return (
        <PanelMessage
          message={message}
          action={{
            label:
              resolved.status === 'unlinked'
                ? 'Choose a layout'
                : 'Choose another',
            onClick: () => onOpenSettings('gantry'),
          }}
        />
      );
    }

    const type = widgetType(resolved);
    const Widget = getWidget(type);
    if (!Widget) return null;

    if (!running && !resolved.widget.alwaysEnabled) {
      return <PanelMessage message="Waiting for iRacing." />;
    }

    return (
      <ErrorBoundary
        label={`gantry-dock:${type}`}
        resetAfterMs={2000}
        fallback={PANEL_ERROR}
      >
        <WidgetRuntimeProvider widgetType={type}>
          {/* embedded: this copy must never write to disk. */}
          <Widget {...resolved.widget.config} embedded />
        </WidgetRuntimeProvider>
      </ErrorBoundary>
    );
  }
);
DockPanelContent.displayName = 'DockPanelContent';
