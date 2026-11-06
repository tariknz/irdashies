import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DriverNamePreview } from './DriverNamePreview';

export default {
  component: DriverNamePreview,
  title: 'components/Settings/DriverNamePreview',
} satisfies Meta<typeof DriverNamePreview>;

export const Selection: StoryObj<typeof DriverNamePreview> = {
  render: () => {
    const [selected, setSelected] = useState('name-middlename-surname');
    return (
      <div className="settings-shell flex max-w-2xl flex-wrap gap-3 bg-slate-900 p-6">
        {[
          'name-middlename-surname',
          'name-m.-surname',
          'name-surname',
          'n.-surname',
          'surname-n.',
          'surname',
        ].map((format) => (
          <DriverNamePreview
            key={format}
            format={format}
            selected={selected === format}
            onClick={() => setSelected(format)}
          />
        ))}
      </div>
    );
  },
};
