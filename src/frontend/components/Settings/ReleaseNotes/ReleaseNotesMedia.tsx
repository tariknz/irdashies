import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultSchema, type Options } from 'rehype-sanitize';

/** Keep the normal Markdown schema, plus the small media subset GitHub emits. */
export const releaseNotesSchema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'video', 'source'],
  attributes: {
    ...defaultSchema.attributes,
    // Deliberately omit autoplay, loop, style, handlers and arbitrary attributes.
    video: ['src', 'poster'],
    source: ['src', 'type'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  protocols: { ...defaultSchema.protocols, src: ['https'], poster: ['https'] },
};

export function releaseMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    const attachment =
      url.hostname === 'github.com' &&
      /^\/user-attachments\/assets\/[a-f0-9-]{36}$/i.test(url.pathname);
    const userImage = url.hostname === 'user-images.githubusercontent.com';
    const repoImage =
      url.hostname === 'raw.githubusercontent.com' &&
      url.pathname.startsWith('/tariknz/irdashies/');
    return attachment || userImage || repoImage ? url.href : null;
  } catch {
    return null;
  }
}

const insideLink = createContext(false);
export const ReleaseNotesLink = ({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <insideLink.Provider value>{children}</insideLink.Provider>
    </a>
  ) : (
    <span>{children}</span>
  );

export interface ReleaseNotesMediaProps {
  src: string;
  alt?: string;
  kind: 'image' | 'video' | 'attachment';
  poster?: string;
  sources?: { src: string; type?: string }[];
}

export const ReleaseNotesMedia = ({
  src,
  alt,
  kind,
  poster,
  sources = [],
}: ReleaseNotesMediaProps) => {
  const linked = useContext(insideLink);
  const safeSrc = releaseMediaUrl(src);
  const safeSources = sources.filter((source) => releaseMediaUrl(source.src));
  const [failed, setFailed] = useState(false);
  const [tryImage, setTryImage] = useState(false);
  const failVideo = () =>
    kind === 'attachment' ? setTryImage(true) : setFailed(true);
  if (!safeSrc) return alt ? <span>{alt}</span> : null;
  const image = kind === 'image' || tryImage;
  const label = image
    ? 'Open image'
    : kind === 'video'
      ? 'Open video'
      : 'Open attachment';
  return (
    <span className="my-3 block max-w-full">
      {failed ? (
        <span
          role="status"
          className="block rounded bg-slate-900/50 p-3 text-slate-400"
        >
          Media could not be loaded. Open it on GitHub to view it.
        </span>
      ) : image ? (
        <img
          src={safeSrc}
          alt={alt || 'Release screenshot'}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="block h-auto max-h-[28rem] max-w-full rounded object-contain"
        />
      ) : (
        <video
          controls
          preload="metadata"
          playsInline
          poster={releaseMediaUrl(poster) ?? undefined}
          src={safeSources.length ? undefined : safeSrc}
          aria-label={alt || 'Release video'}
          onError={failVideo}
          className="block max-h-[28rem] w-full rounded bg-slate-950 object-contain"
        >
          {safeSources.map((source, index) => (
            <source
              key={source.src}
              src={source.src}
              type={source.type}
              onError={index === safeSources.length - 1 ? failVideo : undefined}
            />
          ))}
          Your browser cannot play this video.
        </video>
      )}
      {!linked && (
        <a
          href={safeSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-accent-300 underline"
        >
          {label}
        </a>
      )}
    </span>
  );
};
