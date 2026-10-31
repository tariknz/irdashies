/** Scrub before serialization/truncation so neither keys nor stacks leak paths. */
export function createLogPathScrubber(userData: string, home: string) {
  const prefixes = [
    [userData, '<userData>'],
    [home, '<home>'],
  ] as const;
  const replacements = prefixes.flatMap(([prefix, replacement]) => {
    if (!prefix || prefix === '/' || prefix === '\\') return [];
    const normalized = prefix.replace(/\\/g, '/').replace(/\/$/, '');
    const variants = [normalized, encodeURI(normalized)];
    return variants.map((variant) => ({
      pattern: new RegExp(
        variant
          .split('/')
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join(/^[a-z]:/i.test(normalized) ? '[\\\\/]+' : '[\\\\/]'),
        /^[a-z]:/i.test(normalized) ? 'gi' : 'g'
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
