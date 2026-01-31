import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlagDisplay } from './Flag';

const meta: Meta<typeof FlagDisplay> = {
  title: 'widgets/Flag',
  component: FlagDisplay,
};

export default meta;

type Story = StoryObj<typeof FlagDisplay>;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <FlagDisplay label="NO FLAG" textColor="text-slate-500" showLabel={true} />
      <FlagDisplay label="GREEN" textColor="text-green-500" showLabel={true} />
      <FlagDisplay label="YELLOW" textColor="text-yellow-400" showLabel={true} />
      <FlagDisplay label="YELLOW" textColor="text-yellow-400" showLabel={true} />
      <FlagDisplay label="BLUE" textColor="text-blue-500" showLabel={true} />
      <FlagDisplay label="WHITE" textColor="text-white" showLabel={true} />
      <FlagDisplay label="RED" textColor="text-red-500" showLabel={true} />
      <FlagDisplay label="BLACK" textColor="text-white" showLabel={true} />
      <FlagDisplay label="MEATBALL" textColor="text-orange-500" showLabel={true} />
      <FlagDisplay label="CHECKERED" textColor="text-white" showLabel={true} />
    </div>
  ),
};

export const Green: Story = {
  args: {
    label: 'GREEN',
    textColor: 'text-green-500',
    showLabel: true,
  },
};

export const Yellow: Story = {
  args: {
    label: 'YELLOW',
    textColor: 'text-yellow-400',
    showLabel: true,
  },
};

export const YellowWaving: Story = {
  args: {
    label: 'YELLOW',
    textColor: 'text-yellow-400',
    showLabel: true,
  },
};

export const Blue: Story = {
  args: {
    label: 'BLUE',
    textColor: 'text-blue-500',
    showLabel: true,
  },
};

export const White: Story = {
  args: {
    label: 'WHITE',
    textColor: 'text-white',
    showLabel: true,
  },
};

export const Red: Story = {
  args: {
    label: 'RED',
    textColor: 'text-red-500',
    showLabel: true,
  },
};

export const Black: Story = {
  args: {
    label: 'BLACK',
    textColor: 'text-white',
    showLabel: true,
  },
};

export const Meatball: Story = {
  args: {
    label: 'MEATBALL',
    textColor: 'text-orange-500',
    showLabel: true,
  },
};

export const Checkered: Story = {
  args: {
    label: 'CHECKERED',
    textColor: 'text-white',
    showLabel: true,
  },
};

export const NoFlag: Story = {
  args: {
    label: 'NO FLAG',
    textColor: 'text-slate-500',
    showLabel: true,
  },
};
