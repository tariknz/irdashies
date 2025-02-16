import { Meta } from '@storybook/react';
import { EditMode } from './EditMode';
import { DashboardProvider } from '@irdashies/context';
import type { DashboardBridge } from '@irdashies/types';
import { Input } from '../Input';
import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';
import { Standings } from '../Standings/Standings';

const meta: Meta<typeof EditMode> = {
  component: EditMode,
  decorators: [TelemetryDecorator()],
};
export default meta;

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
  onEditModeToggled: (callback) => {
    callback(editMode);
  },
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
  },
};

export const WithInput = {
  render: (args: { editMode: boolean }) => {
    return (
      <div className="h-[80px] w-[400px]">
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
  },
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
  },
};
