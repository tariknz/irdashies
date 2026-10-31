import { lazy, Suspense } from 'react';
import type { DashboardWidget } from '@irdashies/types';
import {
  DashboardProvider,
  RunningStateProvider,
  SectorTimingUpdater,
  SessionTimingUpdater,
  useContainerOffset,
  useHiddenWidgetIds,
  usePitLapStoreUpdater,
  usePushToPassStoreUpdater,
  useResetOnDisconnect,
  useRunningState,
  useWidgetsForThisDisplay,
} from '@irdashies/context';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import { widgetUpdaterNeeds } from '@irdashies/domain/widgetUpdaterNeeds';
import { getWidget } from '../WidgetIndex';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { HideUIWrapper } from '../components/HideUIWrapper/HideUIWrapper';
import { ProfileSwitchOverlay } from '../components/ProfileSwitchOverlay/ProfileSwitchOverlay';
import { RendererDataProviders } from '../components/RendererDataProviders/RendererDataProviders';
import { ThemeManager } from '../components/ThemeManager/ThemeManager';
import { WidgetRuntimeProvider } from '../widgetRuntime';

const LapTraceUpdater = lazy(() =>
  import('../components/OverlayContainer/LapTraceUpdater').then((module) => ({
    default: module.LapTraceUpdater,
  }))
);

const PushToPassUpdater = () => {
  usePushToPassStoreUpdater(true);
  return null;
};
const PitLapUpdater = () => {
  usePitLapStoreUpdater(true);
  return null;
};

/** Locked-window presentation has no drag/resize hooks or layout-editor chrome. */
export const IndividualWidgetView = ({
  widget,
  running,
}: {
  widget: DashboardWidget;
  running: boolean;
}) => {
  const offset = useContainerOffset();
  const hidden = useHiddenWidgetIds();
  const type = widget.type ?? widget.id;
  const Widget = getWidget(type);
  const needs = widgetUpdaterNeeds(widget);
  if (!Widget || hidden.has(widget.id)) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <WidgetRuntimeProvider widgetType={type}>
        {needs.sectorTiming && <SectorTimingUpdater />}
        {needs.pushToPass && <PushToPassUpdater />}
        {needs.pitLap && <PitLapUpdater />}
        <SessionTimingUpdater soloWidgetType={type} />
        <div
          data-widget-id={widget.id}
          className="absolute pointer-events-none [contain:layout_style_paint]"
          style={{
            left: widget.layout.x + offset.x,
            top: widget.layout.y + offset.y,
            width: widget.layout.width,
            height: widget.layout.height,
          }}
        >
          <WidgetScale scale={widget.scale}>
            {running || widget.alwaysEnabled ? (
              <ErrorBoundary label={`widget:${type}`} resetAfterMs={2000}>
                <Widget {...widget.config} />
              </ErrorBoundary>
            ) : null}
          </WidgetScale>
        </div>
      </WidgetRuntimeProvider>
    </div>
  );
};

const IndividualWidgetContent = () => {
  const widgets = useWidgetsForThisDisplay();
  const widget = widgets[0];
  const { running } = useRunningState();
  useResetOnDisconnect(running);
  return (
    <>
      {/* Recording survives hide hotkeys and is owned by this widget's window. */}
      {widget && (widget.type ?? widget.id) === 'laptrace' && (
        <Suspense fallback={null}>
          <LapTraceUpdater />
        </Suspense>
      )}
      <HideUIWrapper>
        <ProfileSwitchOverlay>
          <ThemeManager>
            {widget && (
              <IndividualWidgetView widget={widget} running={running} />
            )}
          </ThemeManager>
        </ProfileSwitchOverlay>
      </HideUIWrapper>
    </>
  );
};

export default function IndividualWidgetWindow() {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <RendererDataProviders />
        <IndividualWidgetContent />
      </RunningStateProvider>
    </DashboardProvider>
  );
}
