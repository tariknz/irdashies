import type { Meta, StoryObj } from '@storybook/react-vite';
import { DriverTagCell } from './DriverTagCell';
import type { ResolvedDriverTag } from '../../../hooks/useDriverTagMap';

const meta: Meta<typeof DriverTagCell> = {
  component: DriverTagCell,
  title: 'widgets/Standings/components/DriverTagCell',
};

export default meta;
type Story = StoryObj<typeof DriverTagCell>;

const friendTag: ResolvedDriverTag = {
  id: 'friend',
  name: 'Friend',
  icon: 'Star',
  color: 0xffff00,
};

const dangerousTag: ResolvedDriverTag = {
  id: 'dangerous',
  name: 'Dangerous',
  icon: 'Warning',
  color: 0xff0000,
};

export const BadgeStyle: Story = {
  render: () => <DriverTagCell tag={friendTag} displayStyle="badge" />,
};

export const TagStyle: Story = {
  render: () => (
    <DriverTagCell tag={friendTag} displayStyle="tag" widthPx={6} />
  ),
};

export const DangerousBadge: Story = {
  render: () => <DriverTagCell tag={dangerousTag} displayStyle="badge" />,
};

export const NoTag: Story = {
  render: () => <DriverTagCell tag={null} displayStyle="badge" />,
};
