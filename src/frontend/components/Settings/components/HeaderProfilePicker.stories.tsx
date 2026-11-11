import type { Meta, StoryObj } from '@storybook/react-vite';
import layoutMeta, { ProfilePicker } from '../SettingsLayout.stories';
import { SettingsLayout } from '../SettingsLayout';

const meta = {
  ...layoutMeta,
  title: 'components/HeaderProfilePicker',
  component: SettingsLayout,
} satisfies Meta<typeof SettingsLayout>;
export default meta;
export const Default: StoryObj<typeof SettingsLayout> = { ...ProfilePicker };
