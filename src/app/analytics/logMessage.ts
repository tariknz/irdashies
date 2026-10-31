import { pathToFileURL } from 'node:url';

/** Scrub before serialization/truncation so neither keys nor stacks leak paths. */
export function createLogPathScrubber(userData: string, home: string) {
  const prefixes = [
    [userData, '<userData>'],
    [home, '<home>'],
  ] as const;
  const replacements = prefixes.flatMap(([prefix, replacement]) => {
    if (!prefix || prefix === '/' || prefix === '\\') return [];
    const normalized = prefix.replace(/\\/g, '/').replace(/\/$/, '');
    const windows = /^[a-z]:|^\/\//i.test(normalized);
    const fileUrl = pathToFileURL(normalized, { windows });
    // Use actual file-URL encoding: encodeURI leaves '#' and '?' unescaped,
    // while encoding every segment over-encodes characters such as '@'.
    const urlPath = (
      fileUrl.host
        ? `${fileUrl.host}${fileUrl.pathname}`
        : windows
          ? fileUrl.pathname.slice(1)
          : fileUrl.pathname
    ).replace(/\/$/, '');
    const variants = [normalized, encodeURI(normalized), urlPath];
    return variants.map((variant) => ({
      pattern: new RegExp(
        variant
          .split('/')
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join(windows ? '[\\\\/]+' : '[\\\\/]'),
        windows ? 'gi' : 'g'
      ),
      replacement,
    }));
  });
  return (text: string): string => {
    for (const { pattern, replacement } of replacements) {
      text = text.replace(pattern, replacement);
    }
    return text;
  };
}
