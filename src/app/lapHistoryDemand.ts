import { getWidgetManifest } from '@irdashies/types';
import type { DashboardLayout } from '@irdashies/types';
import type { ChannelBus } from './bridge/channelBus';

const CHANNEL = 'lap-history.snapshot';

/**
 * True when an enabled widget's manifest declares `usesLapHistory`. Recording
 * is skipped otherwise, so a user who uses none of them pays no frame cost.
 */
export const needsLapHistory = (layout: DashboardLayout | undefined): boolean =>
  layout?.widgets.some(
    (widget) =>
      widget.enabled &&
      getWidgetManifest(widget.type || widget.id)?.usesLapHistory === true
  ) ?? false;

type DemandBus = Pick<
  ChannelBus,
  'subscriberCount' | 'onSubscriberCountChanged'
>;

/**
 * Calls `onChange` with whether lap history should be recorded, now and on
 * every change. An enabled widget needs it, and so does any live subscriber:
 * a browser source at /widget/<id> renders a widget that is disabled on the
 * desktop.
 */
export const watchLapHistoryDemand = (
  bus: DemandBus,
  initialLayout: DashboardLayout | undefined,
  onDashboardUpdated: (
    listener: (layout: DashboardLayout) => void
  ) => () => void,
  onChange: (needed: boolean) => void,
  resolveLayout?: (layout: DashboardLayout) => DashboardLayout
): (() => void) => {
  const layoutDemand = (layout: DashboardLayout | undefined) =>
    needsLapHistory(layout && resolveLayout ? resolveLayout(layout) : layout);
  let fromLayout = layoutDemand(initialLayout);
  let subscribed = bus.subscriberCount(CHANNEL) > 0;
  let needed: boolean | undefined;
  const update = () => {
    const next = fromLayout || subscribed;
    if (next === needed) return;
    needed = next;
    onChange(next);
  };

  const unsubscribeDashboard = onDashboardUpdated((layout) => {
    fromLayout = layoutDemand(layout);
    update();
  });
  const unsubscribeBus = bus.onSubscriberCountChanged((channel, count) => {
    if (channel !== CHANNEL) return;
    subscribed = count > 0;
    update();
  });
  update();

  return () => {
    unsubscribeDashboard();
    unsubscribeBus();
  };
};
