import { Meta, StoryObj } from '@storybook/react-vite';
import { DriverNameView, DriverNameViewProps } from './DriverNameView';

export default {
  component: DriverNameView,
  title: 'widgets/Standings/components/DriverNameView',
} as Meta;

type Story = StoryObj<DriverNameViewProps>;

export const Primary: Story = {
  args: {
    fullName: 'Charles Marc Hervé Perceval Leclerc',
    format: 'name-surname',
  },
};

export const WithMiddleName: Story = {
  args: {
    fullName: 'Charles Marc Hervé Perceval Leclerc',
    format: 'name-middlename-surname',
  },
};

export const WithMiddleInitial: Story = {
  args: {
    fullName: 'Charles Marc Hervé Perceval Leclerc',
    format: 'name-m.-surname',
  },
};

export const FirstInitialSurname: Story = {
  args: {
    fullName: 'Charles Marc Hervé Perceval Leclerc',
    format: 'n.-surname',
  },
};

export const SurnameOnly: Story = {
  args: {
    fullName: 'Charles Marc Hervé Perceval Leclerc',
    format: 'surname',
  },
};

export const AllFormats: Story = {
  args: {
    fullName: 'Charles Marc Hervé Perceval Leclerc',
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      <DriverNameView {...args} format="name-surname" />
      <DriverNameView {...args} format="name-middlename-surname" />
      <DriverNameView {...args} format="name-m.-surname" />
      <DriverNameView {...args} format="n.-surname" />
      <DriverNameView {...args} format="surname-n." />
      <DriverNameView {...args} format="surname" />
    </div>
  ),
};
