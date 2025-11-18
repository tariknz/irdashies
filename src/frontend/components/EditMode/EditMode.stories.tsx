import { Meta } from '@storybook/react-vite';
import { EditMode } from './EditMode';
import { DashboardProvider } from '@irdashies/context';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { Input } from '../Input';
import { TelemetryDecorator } from '@irdashies/storybook';
import { Standings } from '../Standings/Standings';
import type { InputWidgetSettings } from '../Settings/types';

const defaultInputConfig: InputWidgetSettings['config'] = {
  trace: {
    enabled: true,
    includeThrottle: true,
    includeBrake: true,
    includeAbs: true,
    includeSteer: true,
  },
  bar: {
    enabled: true,
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
    includeAbs: true,
  },
  gear: {
    enabled: true,
    unit: 'auto',
  },
  steer: {
    enabled: true,
    config: {
      style: 'default',
      color: 'dark',
    },
  },
};

const meta: Meta<typeof EditMode> = {
  component: EditMode,
  decorators: [TelemetryDecorator()],
};
export default meta;

const mockDashboard: DashboardLayout = {
  widgets: [],
};

const mockBridge: (editMode: boolean) => DashboardBridge = (editMode) => ({
  saveDashboard: () => {
    // noop
  },
  dashboardUpdated: () => {
    // noop
  },
  reloadDashboard: () => {
    // noop
  },
  resetDashboard: () => Promise.resolve(mockDashboard),
  onEditModeToggled: (callback) => {
    callback(editMode);
  },
  toggleLockOverlays: () => Promise.resolve(true),
  getAppVersion: () => Promise.resolve('1.0.0'),
});

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
      <div className="h-[80px] w-[400px]">
        <DashboardProvider bridge={mockBridge(args.editMode)}>
          <EditMode>
            <Input {...defaultInputConfig} />
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
