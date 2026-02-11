import { useTwitchChatSettings } from './hooks/useTwitchChatSettings';
import { useTwitchChat } from './hooks/useTwitchChat';
import type { ChatMessage } from './types';

export interface TwitchChatDisplayProps {
  background?: { opacity: number };
}

export interface ChatMessageListProps {
  messages: ChatMessage[];
  fontSize: number;
  background: { opacity: number };
}

export const ChatMessageList = ({
  messages,
  fontSize,
  background,
}: ChatMessageListProps) => (
  <div
    className="w-full h-full flex flex-col justify-end bg-slate-800/[var(--bg-opacity)] rounded-sm px-3 py-2 text-white align-bottom border-0 transition-all duration-300"
    style={
      {
        '--bg-opacity': `${background.opacity}%`,
      } as React.CSSProperties
    }
  >
    {messages.map((m) => (
      <div
        key={m.id}
        style={{
          marginBottom: 8,
          fontSize: `${fontSize}px`,
        }}
      >
        <strong style={{ color: '#a970ff' }}>{m.user}</strong>: {m.text}
      </div>
    ))}
  </div>
);

export const TwitchChat = ({
  background = { opacity: 85 },
}: TwitchChatDisplayProps) => {
  const settings = useTwitchChatSettings();
  const messages = useTwitchChat(settings?.config.channel);

  if (!settings) return null;
  if (!settings.enabled) return null;

  return (
    <ChatMessageList
      messages={messages}
      fontSize={settings.config.fontSize}
      background={background}
    />
  );
};
