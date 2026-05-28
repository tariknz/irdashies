const DEFAULT_HOST = 'https://app.hyperate.io';
const WIDGET_HOST = 'https://hyperate.io';
/** Animation used when no widget is configured (blank field) or input is invalid. */
const DEFAULT_ANIMATION = '93';

/** hyperate.io and any subdomain (app., www., …). */
const isHyperateHost = (hostname: string): boolean =>
  /(^|\.)hyperate\.io$/i.test(hostname);

/** The default embed: HypeRate animation 93 for this session. */
const defaultEmbed = (id: string): string =>
  `${DEFAULT_HOST}/animation/${DEFAULT_ANIMATION}/${encodeURIComponent(id)}`;

/**
 * Builds an embeddable HypeRate URL from whatever the user pasted, always
 * filling in OUR session id (any id baked into the input is ignored).
 *
 * HypeRate places the id in one of two ways, detected by host:
 *   - app.hyperate.io  -> id is a PATH segment
 *       app.hyperate.io/<id>                  (default overlay)
 *       app.hyperate.io/animation/<n>/<id>    (animation route)
 *   - hyperate.io / www -> id is the `id` QUERY param
 *       hyperate.io/Bouncing_Heart_Widget?id=<id>
 *
 * Tolerated inputs: blank (default animation 93), bare name
 * ("Bouncing_Heart_Widget"), name+path ("007-Widget/index.html"),
 * "animation/59/<id>", host without scheme, full URLs, and the literal
 * "YOUR-ID-HERE" placeholder. Non-HypeRate or unparseable input also falls
 * back to the default animation.
 */
export function buildHyperateEmbedUrl(
  deviceId: string,
  widgetInput?: string
): string {
  const id = deviceId.trim();
  const raw = widgetInput?.trim();

  if (!raw) {
    return defaultEmbed(id);
  }

  // HypeRate ships their copy-paste URLs with this literal placeholder.
  let str = raw.replace(/YOUR-ID-HERE/gi, id);

  if (!/^https?:\/\//i.test(str)) {
    if (/^[^/\s]+\.[^/\s]+/.test(str)) {
      // Starts with a host (has a dot before the first slash) — add a scheme.
      str = `https://${str}`;
    } else {
      // Bare name/path: animation routes live on app.*, widgets on hyperate.io.
      const path = str.replace(/^\/+/, '');
      const host = /^animation\//i.test(path) ? DEFAULT_HOST : WIDGET_HOST;
      str = `${host}/${path}`;
    }
  }

  let url: URL;
  try {
    url = new URL(str);
  } catch {
    return defaultEmbed(id);
  }

  // Only ever embed HypeRate; anything else falls back to the default animation.
  if (!isHyperateHost(url.hostname)) {
    return defaultEmbed(id);
  }

  if (!id) return url.toString();

  // Drop any id query param the input carried (any casing / duplicates).
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase() === 'id') url.searchParams.delete(key);
  }

  if (url.hostname.toLowerCase() === 'app.hyperate.io') {
    // Path-segment id. Keep the animation id (if any); replace the session slot.
    const segs = url.pathname.split('/').filter(Boolean);
    url.pathname =
      segs[0]?.toLowerCase() === 'animation' && segs[1]
        ? `/animation/${segs[1]}/${encodeURIComponent(id)}`
        : `/${encodeURIComponent(id)}`;
  } else {
    // Query-param id.
    url.searchParams.set('id', id);
  }

  return url.toString();
}
