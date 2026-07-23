import { useState } from 'react';
import type { TwitchEmote } from '../types';
import type { ThirdPartyEmoteMap } from '../hooks/useThirdPartyEmotes';

function getTwitchEmoteUrl(emoteId: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`;
}

interface MessagePart {
  type: 'text' | 'emote' | 'third-party-emote';
  content: string;
  emoteId?: string;
  emoteUrl?: string;
}

function expandTextWithThirdParty(
  text: string,
  emoteMap: ThirdPartyEmoteMap
): MessagePart[] {
  if (!emoteMap.size) return [{ type: 'text', content: text }];
  return text
    .split(/(\s+)/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const url = emoteMap.get(token);
      if (url)
        return { type: 'third-party-emote', content: token, emoteUrl: url };
      return { type: 'text', content: token };
    });
}

function parseMessageParts(
  text: string,
  emotes: TwitchEmote[],
  thirdPartyEmotes: ThirdPartyEmoteMap
): MessagePart[] {
  const nativeParts: MessagePart[] = [];

  if (!emotes.length) {
    nativeParts.push({ type: 'text', content: text });
  } else {
    const positions = emotes
      .flatMap((emote) =>
        emote.indices.map(([start, end]) => ({
          start,
          end: end + 1,
          id: emote.id,
        }))
      )
      .sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const pos of positions) {
      if (cursor < pos.start) {
        nativeParts.push({
          type: 'text',
          content: text.slice(cursor, pos.start),
        });
      }
      nativeParts.push({
        type: 'emote',
        content: text.slice(pos.start, pos.end),
        emoteId: pos.id,
      });
      cursor = pos.end;
    }
    if (cursor < text.length) {
      nativeParts.push({ type: 'text', content: text.slice(cursor) });
    }
  }

  return nativeParts.flatMap((part) => {
    if (part.type === 'text') {
      return expandTextWithThirdParty(part.content, thirdPartyEmotes);
    }
    return [part];
  });
}

interface EmoteImageProps {
  src: string;
  name: string;
  fontSize: number;
}

const EmoteImage = ({ src, name, fontSize }: EmoteImageProps) => {
  const [failed, setFailed] = useState(false);

  if (failed) return <span>{name}</span>;

  return (
    <img
      src={src}
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
  thirdPartyEmotes?: ThirdPartyEmoteMap;
}

export const MessageWithEmotes = ({
  text,
  emotes,
  fontSize,
  thirdPartyEmotes = new Map(),
}: MessageWithEmotesProps) => {
  const parts = parseMessageParts(text, emotes, thirdPartyEmotes);
  let textOffset = 0;

  return (
    <>
      {parts.map((part) => {
        const partKey = `${part.type}-${textOffset}`;
        textOffset += part.content.length;
        if (part.type === 'emote' && part.emoteId) {
          return (
            <EmoteImage
              key={partKey}
              src={getTwitchEmoteUrl(part.emoteId)}
              name={part.content}
              fontSize={fontSize}
            />
          );
        }
        if (part.type === 'third-party-emote' && part.emoteUrl) {
          return (
            <EmoteImage
              key={partKey}
              src={part.emoteUrl}
              name={part.content}
              fontSize={fontSize}
            />
          );
        }
        return <span key={partKey}>{part.content}</span>;
      })}
    </>
  );
};
