import { useState } from 'react';
import type { TwitchEmote } from '../types';

function getTwitchEmoteUrl(emoteId: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`;
}

interface MessagePart {
  type: 'text' | 'emote';
  content: string;
  emoteId?: string;
}

function parseMessageParts(text: string, emotes: TwitchEmote[]): MessagePart[] {
  if (!emotes.length) return [{ type: 'text', content: text }];

  const positions = emotes
    .flatMap((emote) =>
      emote.indices.map(([start, end]) => ({
        start,
        end: end + 1,
        id: emote.id,
      }))
    )
    .sort((a, b) => a.start - b.start);

  const parts: MessagePart[] = [];
  let cursor = 0;

  for (const pos of positions) {
    if (cursor < pos.start) {
      parts.push({ type: 'text', content: text.slice(cursor, pos.start) });
    }
    parts.push({
      type: 'emote',
      content: text.slice(pos.start, pos.end),
      emoteId: pos.id,
    });
    cursor = pos.end;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', content: text.slice(cursor) });
  }

  return parts;
}

interface EmoteImageProps {
  emoteId: string;
  name: string;
  fontSize: number;
}

const EmoteImage = ({ emoteId, name, fontSize }: EmoteImageProps) => {
  const [failed, setFailed] = useState(false);

  if (failed) return <span>{name}</span>;

  return (
    <img
      src={getTwitchEmoteUrl(emoteId)}
      alt={name}
      title={name}
      onError={() => setFailed(true)}
      style={{
        height: fontSize * 1.5,
        verticalAlign: 'middle',
        display: 'inline',
      }}
    />
  );
};

interface MessageWithEmotesProps {
  text: string;
  emotes: TwitchEmote[];
  fontSize: number;
}

export const MessageWithEmotes = ({
  text,
  emotes,
  fontSize,
}: MessageWithEmotesProps) => {
  const parts = parseMessageParts(text, emotes);

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'emote' && part.emoteId ? (
          <EmoteImage
            key={i}
            emoteId={part.emoteId}
            name={part.content}
            fontSize={fontSize}
          />
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </>
  );
};
