import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './types';
import { ChatMessageList } from './StreamChat';
import { DEMO_MESSAGES, DEMO_MESSAGE_INTERVAL_MS } from './demoData';

const MAX_VISIBLE_MESSAGES = 10;

const DisappearingChatDemo = ({
  fontSize,
  background,
}: {
  fontSize: number;
  background: { opacity: number };
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const template = DEMO_MESSAGES[indexRef.current % DEMO_MESSAGES.length];
      setMessages((prev) => [
        ...prev.slice(-(MAX_VISIBLE_MESSAGES - 1)),
        {
          ...template,
          id: crypto.randomUUID(),
          channel: '',
          timestamp: Date.now(),
        },
      ]);
      indexRef.current++;
    }, DEMO_MESSAGE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ChatMessageList
        messages={messages}
        fontSize={fontSize}
        background={background}
        autoHide={{ enabled: true, intervalSeconds: 10 }}
      />
    </div>
  );
};

const LiveChatDemo = ({
  fontSize,
  background,
}: {
  fontSize: number;
  background: { opacity: number };
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const template = DEMO_MESSAGES[indexRef.current % DEMO_MESSAGES.length];
      setMessages((prev) => [
        ...prev.slice(-19),
        {
          ...template,
          id: crypto.randomUUID(),
          channel: '',
          timestamp: Date.now(),
        },
      ]);
      indexRef.current++;
    }, DEMO_MESSAGE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ChatMessageList
        messages={messages}
        fontSize={fontSize}
        background={background}
      />
    </div>
  );
};

export default {
  component: ChatMessageList,
  title: 'widgets/StreamChat',
  decorators: [
    (Story) => (
      <div style={{ width: '350px', height: '400px' }}>
        <Story />
      </div>
    ),
  ],
} as Meta<typeof ChatMessageList>;

const DEMO_STORY_MESSAGES = DEMO_MESSAGES.map((m) => ({ ...m, channel: '' }));

type Story = StoryObj<typeof ChatMessageList>;

export const Default: Story = {
  args: {
    messages: DEMO_STORY_MESSAGES,
    fontSize: 16,
    background: { opacity: 85 },
  },
};

export const Live: Story = {
  render: () => <LiveChatDemo fontSize={16} background={{ opacity: 85 }} />,
};

export const LowOpacity: Story = {
  args: {
    messages: DEMO_STORY_MESSAGES,
    fontSize: 16,
    background: { opacity: 30 },
  },
};

export const LargeFont: Story = {
  args: {
    messages: DEMO_STORY_MESSAGES,
    fontSize: 24,
    background: { opacity: 85 },
  },
};

export const DisappearingMessages: Story = {
  render: () => (
    <DisappearingChatDemo fontSize={16} background={{ opacity: 85 }} />
  ),
};

export const WithPlatformIcons: Story = {
  args: {
    messages: DEMO_STORY_MESSAGES,
    fontSize: 16,
    background: { opacity: 85 },
    showPlatformIcons: true,
  },
};

export const YoutubeOnly: Story = {
  args: {
    messages: DEMO_STORY_MESSAGES.filter((m) => m.platform === 'youtube'),
    fontSize: 16,
    background: { opacity: 85 },
    showPlatformIcons: true,
  },
};
