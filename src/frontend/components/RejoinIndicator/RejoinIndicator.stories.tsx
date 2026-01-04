import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RejoinIndicatorDisplay } from './RejoinIndicator';

const meta: Meta<typeof RejoinIndicatorDisplay> = {
  title: 'widgets/RejoinIndicator',
  component: RejoinIndicatorDisplay,
};

export default meta;

type Story = StoryObj<typeof RejoinIndicatorDisplay>;

export const Clear: Story = {
  args: {
    gap: '4.0s',
    status: 'Clear',
  },
};

export const Caution: Story = {
  args: {
    gap: '2.3s',
    status: 'Caution',
  },
};

export const DoNotRejoin: Story = {
  args: {
    gap: '0.6s',
    status: 'Do Not Rejoin',
  },
};
