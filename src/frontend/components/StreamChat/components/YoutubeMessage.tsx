import type { StreamChatSegment } from '@irdashies/types';

interface YoutubeMessageProps {
  segments: StreamChatSegment[];
  fontSize: number;
}

/** Text with YouTube's inline emoji images, in the order they were typed. */
export const YoutubeMessage = ({ segments, fontSize }: YoutubeMessageProps) => (
  <>
    {segments.map((segment, index) => {
      const key = `${segment.type}-${index}`;
      if (segment.type === 'emoji') {
        return (
          <img
            key={key}
            src={segment.url}
            alt={segment.alt}
            title={segment.alt}
            style={{
              height: fontSize * 1.3,
              verticalAlign: 'middle',
              display: 'inline',
            }}
          />
        );
      }
      return <span key={key}>{segment.text}</span>;
    })}
  </>
);
