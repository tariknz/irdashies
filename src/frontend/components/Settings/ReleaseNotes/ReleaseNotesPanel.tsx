import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import {
  ReleaseNotesMedia,
  ReleaseNotesLink,
  releaseMediaUrl,
  releaseNotesSchema,
} from './ReleaseNotesMedia';
import { ArrowSquareOutIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import type { ReleaseNotesResult } from '@irdashies/types';

const releaseNotesComponents: Components = {
  a: ({ children, href }) => (
    <ReleaseNotesLink href={href}>{children}</ReleaseNotesLink>
  ),
  img: ({ src, alt }) => (
    <ReleaseNotesMedia
      key={typeof src === 'string' ? src : ''}
      src={typeof src === 'string' ? src : ''}
      alt={alt}
      kind="image"
    />
  ),
  video: ({ node, src, poster }) => {
    const sources =
      node?.children.flatMap((child) =>
        child.type === 'element' &&
        child.tagName === 'source' &&
        typeof child.properties.src === 'string'
          ? [
              {
                src: child.properties.src,
                type:
                  typeof child.properties.type === 'string'
                    ? child.properties.type
                    : undefined,
              },
            ]
          : []
      ) ?? [];
    const source =
      releaseMediaUrl(src) ??
      sources.find((item) => releaseMediaUrl(item.src))?.src ??
      '';
    return (
      <ReleaseNotesMedia
        key={source}
        src={source}
        poster={typeof poster === 'string' ? poster : undefined}
        sources={sources}
        kind="video"
      />
    );
  },
  source: () => null,
  p: ({ node, children }) => {
    // GitHub embeds a bare attachment URL as a video. GFM gives us
    // a sole link in a paragraph; try video metadata, then image.
    const child = node?.children.length === 1 ? node.children[0] : null;
    const url =
      child?.type === 'element' && child.tagName === 'a'
        ? releaseMediaUrl(child.properties.href)
        : null;
    if (url)
      return (
        <ReleaseNotesMedia
          key={url}
          src={url}
          kind={
            /\.(?:png|jpe?g|gif|webp|avif)(?:[?#]|$)/i.test(url)
              ? 'image'
              : 'attachment'
          }
        />
      );
    return <p>{children}</p>;
  },
};

export type ReleaseNotesPanelState = ReleaseNotesResult | { status: 'loading' };
export interface ReleaseNotesPanelProps {
  version: string;
  state: ReleaseNotesPanelState;
  onRetry?: () => void;
}

export const ReleaseNotesPanel = ({
  version,
  state,
  onRetry,
}: ReleaseNotesPanelProps) => {
  const release = state.status === 'ready' ? state.release : null;
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {release?.title || `irDashies ${version}`}
          </h3>
          {release?.publishedAt && (
            <p className="mt-1 text-sm text-slate-400">
              Released {new Date(release.publishedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <a
          href={
            release?.url ??
            `https://github.com/tariknz/irdashies/releases/tag/v${encodeURIComponent(version)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 text-sm text-accent-300 hover:underline"
        >
          View on GitHub <ArrowSquareOutIcon size={16} />
        </a>
      </div>
      {state.status === 'loading' && (
        <p role="status" className="text-slate-300">
          Loading release notes…
        </p>
      )}
      {state.status === 'unavailable' && (
        <div
          role="status"
          className="rounded bg-slate-900/50 p-4 text-slate-300"
        >
          <p>
            {state.reason === 'not-found'
              ? 'Release notes have not been published for this version.'
              : 'Could not load release notes. Check your connection and try again.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 flex items-center gap-2 text-accent-300 hover:underline"
            >
              <ArrowClockwiseIcon size={16} /> Try again
            </button>
          )}
        </div>
      )}
      {state.status === 'ready' && state.cached && (
        <p role="status" className="text-sm text-amber-200">
          Showing saved release notes.
        </p>
      )}
      {release &&
        (release.body.trim() ? (
          <div className="text-sm leading-relaxed text-slate-300 break-words [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-accent-300 [&_a]:underline [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-950 [&_pre]:p-3 [&_code]:font-mono [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-slate-500 [&_blockquote]:pl-3 [&_table]:w-full [&_th]:border [&_th]:border-slate-600 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-slate-600 [&_td]:p-2 [&_hr]:my-4 [&_hr]:border-slate-600">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, releaseNotesSchema]]}
              urlTransform={(url) => {
                try {
                  const resolved = new URL(
                    url,
                    'https://github.com/tariknz/irdashies/'
                  );
                  return ['https:', 'http:'].includes(resolved.protocol)
                    ? resolved.href
                    : '';
                } catch {
                  return '';
                }
              }}
              components={releaseNotesComponents}
            >
              {release.body}
            </Markdown>
          </div>
        ) : (
          <p className="text-slate-400">
            No release notes were included for this version.
          </p>
        ))}
    </div>
  );
};
