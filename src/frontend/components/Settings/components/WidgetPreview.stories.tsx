import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator, mockDashboardBridge } from '@irdashies/storybook';
import { DashboardProvider } from '@irdashies/context';
import { defaultDashboard, type DashboardBridge } from '@irdashies/types';
import { WidgetPreview } from './WidgetPreview';

export default {
  title: 'components/Settings/WidgetPreview',
  component: WidgetPreview,
  decorators: [
    TelemetryDecorator(),
    (Story) => (
      <div className="max-w-4xl bg-slate-900 p-5">
        <Story />
      </div>
    ),
  ],
  args: { widgetId: 'input' },
} satisfies Meta<typeof WidgetPreview>;

export const DesktopRequired: StoryObj<typeof WidgetPreview> = {};

/**
 * Edit mode saves layouts from pointer deltas, which on a scaled display are
 * fractions of a CSS pixel. The preview still shows whole pixels.
 */
const fractionalLayout = {
  ...defaultDashboard,
  widgets: defaultDashboard.widgets.map((widget) =>
    widget.id === 'input'
      ? {
          ...widget,
          layout: {
            ...widget.layout,
            width: 396.40000000000003,
            height: 119.99999999999999,
          },
        }
      : widget
  ),
};

const fractionalBridge: DashboardBridge = {
  ...mockDashboardBridge,
  dashboardUpdated: (callback) => {
    callback(fractionalLayout, undefined);
    return () => undefined;
  },
};

export const FractionalSavedSize: StoryObj<typeof WidgetPreview> = {
  decorators: [
    (Story) => (
      <DashboardProvider bridge={fractionalBridge}>
        <Story />
      </DashboardProvider>
    ),
  ],
};
