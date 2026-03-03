import { useEffect, useState } from 'react';
import { Client } from '@tmi.js/chat';
import type { ChatMessage, TwitchMessageEvent } from '../types';

export function useTwitchChat(channel: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!channel) return;

    const client = new Client({
      channels: [channel],
    });

    client.connect();

    client.on('message', (msg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = msg as any as TwitchMessageEvent;
      const username = event.user.display || event.user.login || 'Unknown';
      const messageText = event.message.text || '';

      if (messageText && username !== 'Unknown') {
        setMessages((prev) => [
          ...prev,
          { user: username, text: messageText, id: crypto.randomUUID() },
        ]);
      }
    });

    return () => {
      client.close();
    };
  }, [channel]);

  return messages;
}
