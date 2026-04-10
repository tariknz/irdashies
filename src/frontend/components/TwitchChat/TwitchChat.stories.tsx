import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChatMessage } from './types';
import { ChatMessageList } from './TwitchChat';

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    user: 'SpeedDemon99',
    text: 'Great overtake on turn 3!',
    emotes: [],
  },
  { id: '2', user: 'RaceFanatic', text: 'That was so close omg', emotes: [] },
  {
    id: '3',
    user: 'SimRacerPro',
    text: 'Clean racing from everyone today',
    emotes: [],
  },
  { id: '4', user: 'PitCrewChief', text: 'Box box box next lap', emotes: [] },
  {
    id: '5',
    user: 'TrackDayBro',
    text: 'Anyone else seeing the rain coming in?',
    emotes: [],
  },
  // PogChamp emote (id: 305954156) at positions 4-11
  {
    id: '6',
    user: 'ApexHunter',
    text: 'P3! PogChamp Lets gooo',
    emotes: [{ id: '305954156', indices: [[4, 11]] }],
  },
  {
    id: '7',
    user: 'GripLevel100',
    text: 'That dive bomb was sketchy but it worked',
    emotes: [],
  },
  {
    id: '8',
    user: 'FuelStrategist',
    text: 'Saving fuel for the last stint',
    emotes: [],
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
