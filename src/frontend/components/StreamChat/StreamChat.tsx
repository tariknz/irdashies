import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useDashboard,
  useStreamChatEmotes,
  useStreamChatMessagesSnapshot,
} from '@irdashies/context';
import { useStreamChatSettings } from './hooks/useStreamChatSettings';
import { MessageWithEmotes } from './components/MessageWithEmotes';
import { MessageHeader } from './components/MessageHeader';
import { YoutubeMessage } from './components/YoutubeMessage';
import {
  DEMO_MESSAGE_INTERVAL_MS,
  getDemoMessages,
  type DemoPlatforms,
} from './demoData';
import type { ChatMessage, ThirdPartyEmoteMap } from './types';

export interface StreamChatDisplayProps {
  background?: { opacity: number };
}

export interface ChatMessageListProps {
  messages: ChatMessage[];
  fontSize: number;
  background: { opacity: number };
  autoHide?: { enabled: boolean; intervalSeconds: number };
  thirdPartyEmotes?: ThirdPartyEmoteMap;
  showPlatformIcons?: boolean;
}

const FADE_DURATION_MS = 1000;

export const ChatMessageList = ({
  messages,
  fontSize,
  background,
  autoHide,
  thirdPartyEmotes,
  showPlatformIcons = false,
}: ChatMessageListProps) => {
  const [fadingIds, setFadingIds] = useState<Set<string>>(() => new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const removeTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!autoHide?.enabled) {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
      removeTimeoutsRef.current.forEach(clearTimeout);
      removeTimeoutsRef.current.clear();
      return;
    }

    messages.forEach((m) => {
      if (!timeoutsRef.current.has(m.id)) {
        const t = setTimeout(() => {
          setFadingIds((prev) => new Set([...prev, m.id]));
          // Both timeout maps are cleared by the unmount effect below; this
          // rule only recognizes cleanup in the effect that creates the timer.
          const rt = setTimeout(() => {
            setRemovedIds((prev) => new Set([...prev, m.id]));
          }, FADE_DURATION_MS);
          removeTimeoutsRef.current.set(m.id, rt);
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
    const timeouts = timeoutsRef.current;
    const removeTimeouts = removeTimeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
      removeTimeouts.forEach(clearTimeout);
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
      {messages
        .filter((m) => !removedIds.has(m.id))
        .map((m) => {
          const fading = (autoHide?.enabled ?? false) && fadingIds.has(m.id);
          return (
            <div
              key={m.id}
              style={{
                marginBottom: 8,
                fontSize: `${fontSize}px`,
                opacity: fading ? 0 : 1,
                transition: fading
                  ? `opacity ${FADE_DURATION_MS}ms linear`
                  : undefined,
              }}
            >
              <MessageHeader
                platform={m.platform}
                badges={m.badges}
                showPlatformIcon={showPlatformIcons}
                fontSize={fontSize}
              />
              <strong
                style={{
                  color:
                    m.color ??
                    (m.platform === 'twitch' ? '#a970ff' : '#ffffff'),
                }}
              >
                {m.user}
              </strong>
              :{' '}
              {m.segments ? (
                <YoutubeMessage segments={m.segments} fontSize={fontSize} />
              ) : (
                <MessageWithEmotes
                  text={m.text}
                  emotes={m.emotes}
                  fontSize={fontSize}
                  thirdPartyEmotes={thirdPartyEmotes}
                />
              )}
            </div>
          );
        })}
    </div>
  );
};

const DemoChatMessages = ({
  background,
  autoHide,
  showPlatformIcons,
  twitch,
  youtube,
}: {
  background: { opacity: number };
  autoHide?: { enabled: boolean; intervalSeconds: number };
  showPlatformIcons: boolean;
} & DemoPlatforms) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const indexRef = useRef(0);
  const demoMessages = useMemo(
    () => getDemoMessages({ twitch, youtube }),
    [twitch, youtube]
  );

  useEffect(() => {
    setMessages([]);
    indexRef.current = 0;
    if (!demoMessages.length) return;
    const interval = setInterval(() => {
      const template = demoMessages[indexRef.current % demoMessages.length];
      setMessages((prev) => [
        ...prev.slice(-19),
        { ...template, id: crypto.randomUUID(), timestamp: Date.now() },
      ]);
      indexRef.current++;
    }, DEMO_MESSAGE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [demoMessages]);

  return (
    <ChatMessageList
      messages={messages}
      fontSize={16}
      background={background}
      autoHide={autoHide}
      showPlatformIcons={showPlatformIcons}
    />
  );
};

export const StreamChat = ({
  background: backgroundProp,
}: StreamChatDisplayProps) => {
  const { isDemoMode } = useDashboard();
  const settings = useStreamChatSettings();
  const background = backgroundProp ??
    settings?.config.display.background ?? { opacity: 30 };
  const active = !isDemoMode && (settings?.enabled ?? false);
  const snapshot = useStreamChatMessagesSnapshot(active);
  const thirdPartyEmotes = useStreamChatEmotes(active);
  const messages = useMemo(() => snapshot?.messages ?? [], [snapshot]);

  if (isDemoMode) {
    return (
      <DemoChatMessages
        background={background}
        autoHide={settings?.config.display.autoHide}
        showPlatformIcons={settings?.config.display.showPlatformIcons ?? true}
        twitch={!!settings?.config.twitch?.channel?.trim()}
        youtube={!!settings?.config.youtube?.channel?.trim()}
      />
    );
  }

  if (!settings) return null;
  if (!settings.enabled) return null;

  return (
    <ChatMessageList
      messages={messages}
      fontSize={settings.config.display.fontSize}
      background={background}
      autoHide={settings.config.display.autoHide}
      thirdPartyEmotes={thirdPartyEmotes}
      showPlatformIcons={settings.config.display.showPlatformIcons}
    />
  );
};
