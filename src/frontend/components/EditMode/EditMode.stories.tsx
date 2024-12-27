import { Meta } from '@storybook/react';
import { EditMode } from './EditMode';
import { DashboardProvider } from '@irdashies/context';
import type { DashboardBridge } from '@irdashies/types';

const meta: Meta<typeof EditMode> = {
  component: EditMode,
};
export default meta;

export const Primary = {
  render: (args: { editMode: boolean }) => {
    const mockBridge: DashboardBridge = {
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
        callback(args.editMode);
      },
    };
    return (
      <DashboardProvider bridge={mockBridge}>
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
