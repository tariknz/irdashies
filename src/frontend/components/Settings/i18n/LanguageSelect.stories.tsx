import { Meta, StoryObj } from '@storybook/react-vite';
import { LanguageSelect } from './LanguageSelect';

const meta: Meta<typeof LanguageSelect> = {
  component: LanguageSelect,
  title: 'components/Settings/LanguageSelect',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    reload: () => undefined,
  },
};
