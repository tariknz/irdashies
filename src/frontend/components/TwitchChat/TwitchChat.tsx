import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { useTwitchChatSettings } from './hooks/useTwitchChatSettings';
import { useTwitchChat } from './hooks/useTwitchChat';
import { MessageWithEmotes } from './components/MessageWithEmotes';
import { DEMO_MESSAGES, DEMO_MESSAGE_INTERVAL_MS } from './demoData';
import type { ChatMessage } from './types';

export interface TwitchChatDisplayProps {
  background?: { opacity: number };
}

export interface ChatMessageListProps {
  messages: ChatMessage[];
  fontSize: number;
  background: { opacity: number };
  autoHide?: { enabled: boolean; intervalSeconds: number };
}

export const ChatMessageList = ({
  messages,
  fontSize,
  background,
  autoHide,
}: ChatMessageListProps) => {
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!autoHide?.enabled) {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
      setFadingIds(new Set());
      return;
    }

    messages.forEach((m) => {
      if (!timeoutsRef.current.has(m.id)) {
        const t = setTimeout(() => {
          setFadingIds((prev) => new Set([...prev, m.id]));
        }, autoHide.intervalSeconds * 1000);
        timeoutsRef.current.set(m.id, t);
      }
    });

    const currentIds = new Set(messages.map((m) => m.id));
    timeoutsRef.current.forEach((t, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(t);
        timeoutsRef.current.delete(id);
      }
    });
  }, [messages, autoHide?.enabled, autoHide?.intervalSeconds]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col justify-end overflow-hidden bg-slate-800/[var(--bg-opacity)] rounded-sm px-3 py-2 text-white align-bottom border-0 transition-all duration-300"
      style={
        {
          '--bg-opacity': `${background.opacity}%`,
        } as React.CSSProperties
      }
    >
      {messages.map((m) => {
        const fading = fadingIds.has(m.id);
        return (
          <div
            key={m.id}
            style={{
              marginBottom: 8,
              fontSize: `${fontSize}px`,
              opacity: fading ? 0 : 1,
              transition: fading ? 'opacity 1s linear' : undefined,
            }}
          >
            <strong style={{ color: m.color ?? '#a970ff' }}>{m.user}</strong>:{' '}
            <MessageWithEmotes
              text={m.text}
              emotes={m.emotes}
              fontSize={fontSize}
            />
          </div>
        );
      })}
    </div>
  );
};

const DemoChatMessages = ({
  background,
  autoHide,
}: {
  background: { opacity: number };
  autoHide?: { enabled: boolean; intervalSeconds: number };
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const template = DEMO_MESSAGES[indexRef.current % DEMO_MESSAGES.length];
      setMessages((prev) => [
        ...prev.slice(-19),
        { ...template, id: crypto.randomUUID() },
      ]);
      indexRef.current++;
    }, DEMO_MESSAGE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <ChatMessageList
      messages={messages}
      fontSize={16}
      background={background}
      autoHide={autoHide}
    />
  );
};

export const TwitchChat = ({
  background = { opacity: 85 },
}: TwitchChatDisplayProps) => {
  const { isDemoMode } = useDashboard();
  const settings = useTwitchChatSettings();
  const messages = useTwitchChat(
    isDemoMode ? undefined : settings?.config.channel
  );

  if (isDemoMode) {
    return (
      <DemoChatMessages
        background={background}
        autoHide={settings?.config.autoHide}
      />
    );
  }

  if (!settings) return null;
  if (!settings.enabled) return null;

  return (
    <ChatMessageList
      messages={messages}
      fontSize={settings.config.fontSize}
      background={background}
      autoHide={settings.config.autoHide}
    />
  );
};
