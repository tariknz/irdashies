import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MenuSortControl } from './MenuSortControl';
import type { MenuSortMode } from '../menuSort';

const meta: Meta<typeof MenuSortControl> = {
  component: MenuSortControl,
  title: 'components/MenuSortControl',
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Click the icon to step to the next order, or the caret to pick one. */
export const Default: Story = {
  render: () => {
    const [mode, setMode] = useState<MenuSortMode>('category');
    return (
      <div className="flex items-center gap-3 bg-slate-950 p-4 text-sm text-slate-300">
        <MenuSortControl mode={mode} onChange={setMode} />
        <span>{mode}</span>
      </div>
    );
  },
};
