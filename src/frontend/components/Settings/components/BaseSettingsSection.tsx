import { ReactNode, useContext, useState } from 'react';
import { menuHasToggle } from '../menuItems';
import { ToggleSwitch } from './ToggleSwitch';
import { ConfirmDialog } from './ConfirmDialog';
import { BaseWidgetSettings } from '@irdashies/types';
import {
  useActiveSimulator,
  useDashboard,
  useSimWidgetSupport,
} from '@irdashies/context';
import {
  widgetDisabledMessage,
  widgetIncompatibleLabel,
} from '@irdashies/types';
import { SettingsPreviewContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { WidgetPreview } from './WidgetPreview';
import { SettingsPreviewLayout } from './SettingsPreviewLayout';

const isConfigObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function mergeConfigChanges(
  latest: Record<string, unknown>,
  rendered: Record<string, unknown>,
  changes: Record<string, unknown>
) {
  const merged = { ...latest };
  for (const [key, value] of Object.entries(changes)) {
    if (value === rendered[key]) continue;

    const latestValue = latest[key];
    const renderedValue = rendered[key];
    if (
      isConfigObject(value) &&
      isConfigObject(latestValue) &&
      isConfigObject(renderedValue) &&
      typeof value.type !== 'string' &&
      typeof renderedValue.type !== 'string'
    ) {
      const retainedEntries = Object.entries(latestValue).filter(
        ([entry]) =>
          !Object.hasOwn(renderedValue, entry) || Object.hasOwn(value, entry)
      );
      merged[key] = mergeConfigChanges(
        Object.fromEntries(retainedEntries),
        renderedValue,
        value
      );
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

interface BaseSettingsSectionProps<T> {
  title: string;
  headingLevel?: 'h2' | 'h3';
  description: ReactNode;
  settings?: BaseWidgetSettings<T>;
  widgetId?: string;
  children?:
    | ((handleConfigChange: (config: Partial<T>) => void) => ReactNode)
    | ReactNode;
  disableInternalScroll?: boolean;
  /** For widgets that never appear on the overlay, so have no position. */
  hidePositionReset?: boolean;
  /** Embedded widgets, such as the inspector, can opt into the same layout. */
  previewWidgetId?: string;
}

export const BaseSettingsSection = <T,>({
  title,
  headingLevel: Heading = 'h2',
  description,
  settings,
  widgetId,
  children,
  disableInternalScroll = false,
  hidePositionReset = false,
  previewWidgetId: explicitPreviewWidgetId,
}: BaseSettingsSectionProps<T>) => {
  const selectedWidgetId = useContext(SettingsPreviewContext);
  const previewWidgetId =
    explicitPreviewWidgetId ??
    (Heading === 'h2' ? selectedWidgetId : undefined);
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const simulator = useActiveSimulator();
  const supportConfig = useSimWidgetSupport();
  // The running sim cannot show this widget. The toggle is greyed and the saved
  // setting is left untouched, so it returns as the user left it under a sim
  // that supports it.
  const simDisabledReason = widgetDisabledMessage(
    supportConfig,
    widgetId,
    simulator
  );
  // The settings menu already has this widget's switch; skip the duplicate.
  // A sim-unsupported widget is not in the menu, so its page keeps its own.
  const menuToggles =
    !simDisabledReason &&
    !!widgetId &&
    menuHasToggle(widgetId, currentDashboard?.widgets.map((w) => w.id) ?? []);
  const savedWidget = currentDashboard?.widgets.find((w) => w.id === widgetId);
  // The Gantry renders its own layouts whatever their enabled flag says.
  const isGantryOnly = savedWidget?.placement === 'gantry';
  const simIncompatibleLabel = simDisabledReason
    ? widgetIncompatibleLabel(simulator)
    : null;

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetPosition = () => {
    setShowResetConfirm(true);
  };

  const confirmResetPosition = () => {
    setShowResetConfirm(false);
    onDashboardUpdated?.((dashboard) => ({
      ...dashboard,
      widgets: dashboard.widgets.map((widget) =>
        widget.id !== widgetId
          ? widget
          : {
              ...widget,
              layout: {
                ...widget.layout,
                x: 0,
                y: 0,
              },
              config: {
                ...widget.config,
                browserPosition: undefined,
              },
            }
      ),
    }));
  };

  if (!settings || !widgetId) {
    return (
      <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        {previewWidgetId && (
          <WidgetPreview key={previewWidgetId} widgetId={previewWidgetId} />
        )}
        {children &&
          (typeof children === 'function'
            ? children(() => undefined)
            : children)}
      </section>
    );
  }

  const updateWidget = (configChange?: Partial<T>, enabled?: boolean) => {
    const renderedConfig = settings.config as unknown as Record<
      string,
      unknown
    >;
    onDashboardUpdated?.((dashboard) => {
      const current = dashboard.widgets.find(
        (widget) => widget.id === widgetId
      );
      if (!current && savedWidget) return dashboard;

      const config = mergeConfigChanges(
        current === savedWidget
          ? renderedConfig
          : (current?.config ?? renderedConfig),
        renderedConfig,
        (configChange as Record<string, unknown>) ?? {}
      );
      const widget = {
        ...(current ?? {
          id: widgetId,
          layout: { x: 50, y: 50, width: 400, height: 300 },
        }),
        enabled: enabled ?? current?.enabled ?? settings.enabled,
        config,
      };
      return {
        ...dashboard,
        widgets: current
          ? dashboard.widgets.map((entry) =>
              entry.id === widgetId ? widget : entry
            )
          : [...dashboard.widgets, widget],
      };
    });
  };

  const content = (
    <>
      {children && (
        <div className="space-y-4">
          {typeof children === 'function' ? children(updateWidget) : children}
        </div>
      )}
      {!hidePositionReset && (
        <div className="flex justify-center p-4 pt-2 mt-2">
          <button
            type="button"
            onClick={handleResetPosition}
            className="min-h-9 rounded-md border border-settings-boundary bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:border-accent-400"
          >
            Reset Position
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Position"
        message="This will reset the position for both the on-screen overlay and the browser/URL source version."
        confirmText="Reset Position"
        onConfirm={confirmResetPosition}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  );

  return (
    <div
      className={`flex min-h-0 flex-col ${disableInternalScroll ? '' : 'h-full'}`}
    >
      <header className="flex-none border-b border-slate-700 px-1 pb-5 pt-1">
        <div>
          <div className="flex justify-between items-center mb-1">
            <Heading
              className={
                Heading === 'h2'
                  ? 'text-xl font-semibold tracking-tight text-white'
                  : 'text-lg font-semibold text-white'
              }
            >
              {title}
            </Heading>
            <div className="flex flex-col items-end gap-0.5">
              {!menuToggles && !isGantryOnly && (
                <ToggleSwitch
                  ariaLabel={`Enable ${title}`}
                  enabled={settings.enabled}
                  disabled={!!simDisabledReason}
                  disabledReason={simDisabledReason ?? undefined}
                  onToggle={(enabled) => updateWidget(undefined, enabled)}
                />
              )}
              {simIncompatibleLabel && (
                <span
                  className="text-xs text-slate-500"
                  title={simDisabledReason ?? undefined}
                >
                  {simIncompatibleLabel}
                </span>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </header>

      {previewWidgetId ? (
        <SettingsPreviewLayout
          widgetId={previewWidgetId}
          scroll={!disableInternalScroll}
        >
          {content}
        </SettingsPreviewLayout>
      ) : (
        <div
          className={`${disableInternalScroll ? '' : 'flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]'} pt-5 pr-1`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
