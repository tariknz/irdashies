import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChatMessage } from './types';
import { ChatMessageList } from './TwitchChat';

const mockMessages: ChatMessage[] = [
  { id: '1', user: 'SpeedDemon99', text: 'Great overtake on turn 3!' },
  { id: '2', user: 'RaceFanatic', text: 'That was so close omg' },
  {
    id: '3',
    user: 'SimRacerPro',
    text: 'Clean racing from everyone today',
  },
  { id: '4', user: 'PitCrewChief', text: 'Box box box next lap' },
  {
    id: '5',
    user: 'TrackDayBro',
    text: 'Anyone else seeing the rain coming in?',
  },
  { id: '6', user: 'ApexHunter', text: 'P3! Lets gooo' },
  {
    id: '7',
    user: 'GripLevel100',
    text: 'That dive bomb was sketchy but it worked',
  },
  {
    id: '8',
    user: 'FuelStrategist',
    text: 'Saving fuel for the last stint',
  },
];

export default {
  component: ChatMessageList,
  title: 'widgets/TwitchChat',
  decorators: [
    (Story) => (
      <div style={{ width: '350px', height: '400px' }}>
        <Story />
      </div>
    ),
  ],
} as Meta<typeof ChatMessageList>;

type Story = StoryObj<typeof ChatMessageList>;

export const Default: Story = {
  args: {
    messages: mockMessages,
    fontSize: 16,
    background: { opacity: 85 },
  },
};

export const LowOpacity: Story = {
  args: {
    messages: mockMessages,
    fontSize: 16,
    background: { opacity: 30 },
  },
};

export const LargeFont: Story = {
  args: {
    messages: mockMessages,
    fontSize: 24,
    background: { opacity: 85 },
  },
};
