import { Meta } from '@storybook/react-vite';
import { EditMode } from './EditMode';
import { DashboardProvider } from '@irdashies/context';
import type {
  DashboardBridge,
  DashboardLayout,
  DashboardWidget,
  GeneralSettingsType,
} from '@irdashies/types';
import { Input } from '../Input';
import { TelemetryDecorator, mockDashboardBridge } from '@irdashies/storybook';
import { Standings } from '../Standings/Standings';
import { WidgetContainer } from '../WidgetContainer';
import { useCallback, useMemo, useState } from 'react';
import type { WidgetLayout } from '@irdashies/types';

const meta: Meta<typeof EditMode> = {
  component: EditMode,
  title: 'components/EditMode',
  decorators: [TelemetryDecorator()],
};
export default meta;

const mockDashboard: DashboardLayout = {
  widgets: [],
};

const mockBridge: (editMode: boolean) => DashboardBridge = (editMode) => ({
  ...mockDashboardBridge,
  dashboardUpdated: () => {
    return undefined;
  },
  resetDashboard: () => Promise.resolve(mockDashboard),
  onEditModeToggled: (callback) => {
    callback(editMode);
    return undefined;
  },
});

const VIEWPORT = { x: 0, y: 0, width: 1200, height: 700 };

const sampleWidgets: DashboardWidget[] = [
  {
    id: 'standings',
    enabled: true,
    layout: { x: 24, y: 24, width: 280, height: 360 },
  },
  {
    id: 'input',
    enabled: true,
    layout: { x: 380, y: 24, width: 340, height: 100 },
  },
  {
    id: 'fuel',
    enabled: true,
    layout: { x: 380, y: 180, width: 340, height: 300 },
  },
];

const createEditModeBridge = (
  generalSettings: Partial<GeneralSettingsType>
): DashboardBridge => {
  const dashboard: DashboardLayout = {
    widgets: sampleWidgets,
    generalSettings: {
      ...generalSettings,
      editMode: {
        pixelDistances: true,
        snapToGrid: true,
        ...generalSettings.editMode,
      },
    },
  };
  return {
    ...mockDashboardBridge,
    dashboardUpdated: (callback) => {
      callback(dashboard, undefined);
      return () => undefined;
    },
    resetDashboard: async () => dashboard,
    onEditModeToggled: (callback) => {
      callback(true);
      return () => undefined;
    },
    onContainerBoundsInfo: (callback) => {
      callback({
        expected: VIEWPORT,
        actual: VIEWPORT,
        offset: { x: 0, y: 0 },
        isPrimary: true,
        displayBounds: VIEWPORT,
      });
      return () => undefined;
    },
  };
};

interface WidgetPlaceholderProps {
  label: string;
  color: string;
}

const WidgetPlaceholder = ({ label, color }: WidgetPlaceholderProps) => (
  <div
    className={`w-full h-full ${color} flex items-center justify-center text-white/80 text-sm`}
  >
    {label}
  </div>
);

const widgetContent: Record<string, { label: string; color: string }> = {
  standings: { label: 'Standings', color: 'bg-slate-800/80' },
  input: { label: 'Input Trace', color: 'bg-slate-700/80' },
  fuel: { label: 'Fuel Calculator', color: 'bg-slate-800/80' },
};

interface MultiWidgetSceneProps {
  generalSettings: Partial<GeneralSettingsType>;
}

const MultiWidgetScene = ({ generalSettings }: MultiWidgetSceneProps) => {
  const bridge = useMemo(
    () => createEditModeBridge(generalSettings),
    [generalSettings]
  );
  const [widgets, setWidgets] = useState(sampleWidgets);

  const handleLayoutChange = useCallback(
    (widgetId: string, layout: WidgetLayout) => {
      setWidgets((prev) =>
        prev.map((w) => (w.id === widgetId ? { ...w, layout } : w))
      );
    },
    []
  );

  return (
    <DashboardProvider bridge={bridge}>
      <div
        className="relative bg-blue-900/20 overflow-hidden"
        style={{ width: VIEWPORT.width, height: VIEWPORT.height }}
      >
        {widgets.map((widget, i) => {
          const content = widgetContent[widget.id];
          const siblingLayouts = widgets
            .filter((w) => w.id !== widget.id)
            .map((w) => w.layout);
          return (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              siblingLayouts={siblingLayouts}
              editMode={true}
              zIndex={i + 1}
              onLayoutChange={handleLayoutChange}
            >
              <WidgetPlaceholder
                label={content?.label ?? widget.id}
                color={content?.color ?? 'bg-slate-800/80'}
              />
            </WidgetContainer>
          );
        })}
      </div>
    </DashboardProvider>
  );
};

export const Primary = {
  render: (args: { editMode: boolean }) => {
    return (
      <DashboardProvider bridge={mockBridge(args.editMode)}>
        <EditMode>
          <div className="h-20">Some content</div>
        </EditMode>
      </DashboardProvider>
    );
  },
  args: {
    editMode: true,
  } as { editMode: boolean },
};

export const WithInput = {
  render: (args: { editMode: boolean }) => {
    return (
      <div className="h-[140px] w-[420px]">
        <DashboardProvider bridge={mockBridge(args.editMode)}>
          <EditMode>
            <Input />
          </EditMode>
        </DashboardProvider>
      </div>
    );
  },
  args: {
    editMode: true,
  } as { editMode: boolean },
};

export const WithStandings = {
  render: (args: { editMode: boolean }) => {
    return (
      <DashboardProvider bridge={mockBridge(args.editMode)}>
        <EditMode>
          <Standings />
        </EditMode>
      </DashboardProvider>
    );
  },
  args: {
    editMode: true,
  } as { editMode: boolean },
};

export const DistanceLabelsVisible = {
  render: () => (
    <MultiWidgetScene
      generalSettings={{
        editMode: {
          pixelDistances: true,
          snapToGrid: true,
        },
      }}
    />
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Three widgets in edit mode with pixel distance labels visible on each edge. Drag widgets to see labels update live.',
      },
    },
  },
};

export const DistanceLabelsHidden = {
  render: () => (
    <MultiWidgetScene
      generalSettings={{
        editMode: {
          pixelDistances: false,
          snapToGrid: true,
        },
      }}
    />
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Same layout with pixel distance labels turned off. Widget edit chrome is still visible but without the edge distance readouts.',
      },
    },
  },
};

export const SnappingEnabled = {
  render: () => (
    <MultiWidgetScene
      generalSettings={{
        editMode: {
          pixelDistances: true,
          snapToGrid: true,
        },
      }}
    />
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Grid snapping is active. Drag or resize a widget and it will snap to the viewport grid and lock to nearby sibling edges. Hold Shift to bypass snapping temporarily.',
      },
    },
  },
};

export const SnappingDisabled = {
  render: () => (
    <MultiWidgetScene
      generalSettings={{
        editMode: {
          pixelDistances: true,
          snapToGrid: false,
        },
      }}
    />
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Grid snapping is turned off. Widgets move and resize freely with pixel-level precision. Distance labels are still visible.',
      },
    },
  },
};
