import { useEffect, useState } from 'react';
import { Client } from '@tmi.js/chat';
import type { RoomState } from '@tmi.js/chat';
import type { ChatMessage, TwitchMessageEvent } from '../types';

export function useTwitchChat(channel: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | undefined>();

  useEffect(() => {
    if (!channel) return;

    const client = new Client({
      channels: [channel],
    });

    client.connect();

    client.on('roomState', (event: RoomState.Event) => {
      if (event.tags.roomId) {
        setRoomId(event.tags.roomId);
      }
    });

    client.on('message', (msg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = msg as any as TwitchMessageEvent;
      const username = event.user.display || event.user.login || 'Unknown';
      const messageText = event.message.text || '';
      const emotes = event.message.emotes ?? [];
      const color = event.user.color || undefined;

      if (messageText && username !== 'Unknown') {
        setMessages((prev) => [
          ...prev,
          {
            user: username,
            color,
            text: messageText,
            id: crypto.randomUUID(),
            emotes,
          },
        ]);
      }
    });

    return () => {
      client.close();
    };
  }, [channel]);

  return { messages, roomId };
}
