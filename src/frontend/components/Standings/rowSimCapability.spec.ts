import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every DriverInfoRow in a standings widget is handed both badge inputs.
 *
 * `hasDriverRatings` and `isAI` together decide what the badge cell draws: a
 * rank, the "AI" placeholder, or nothing. Both are passed down rather than
 * read from context, which keeps the rows driven by props -- but it also means
 * a row site that forgets one silently falls back to the prop's default and
 * draws the wrong thing.
 *
 * That is exactly what happened: Relative renders rows in three places --
 * filler rows when there is no player, placeholder rows, and the real driver
 * rows -- and only the first was given the prop. Standings was right, Relative
 * showed "AI" on every AI entry, and nothing failed. The cell has its own
 * specs for the decision and the row has one for passing it on; neither could
 * see a widget that never supplied it.
 *
 * Read out of the source rather than rendered, following
 * app/lmu/rest/recorderParity.spec.ts: mounting these widgets needs the whole
 * context tree, and what is worth asserting is a property of every call site,
 * including ones nobody thought to write a render test for.
 */
const WIDGETS = ['Standings.tsx', 'Relative.tsx'];

/**
 * Both inputs, because defaulting either one is silent.
 *
 * The filler and placeholder rows are not people, and pass `isAI={false}`
 * rather than being exempted -- an exemption is a hole, and they are already
 * explicit about every other driver prop.
 */
const REQUIRED = ['hasDriverRatings=', 'isAI='];

/** Each `<DriverInfoRow ... />` in a file, with the line it starts on. */
const rowSites = (source: string): { line: number; body: string }[] => {
  const sites: { line: number; body: string }[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf('<DriverInfoRow', from);
    if (start === -1) break;
    const end = source.indexOf('/>', start);
    // Not a soft failure: an unterminated element means this is no longer
    // reading what it claims to, and passing would be worse than failing.
    if (end === -1) throw new Error('unterminated <DriverInfoRow');
    sites.push({
      line: source.slice(0, start).split('\n').length,
      body: source.slice(start, end),
    });
    from = end;
  }
  return sites;
};

describe('standings row sites', () => {
  it.each(WIDGETS)('hands %s both badge inputs at every row', (file) => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/frontend/components/Standings', file),
      'utf8'
    );
    const sites = rowSites(source);

    // Guards the parse itself: a spec that read no sites would pass forever.
    expect(sites.length).toBeGreaterThan(0);

    // Named by line, so a failure says which row site to fix rather than only
    // that one of them is wrong.
    const missing = sites.flatMap((site) =>
      REQUIRED.filter((prop) => !site.body.includes(prop)).map(
        (prop) => `${file}:${site.line} is missing ${prop}`
      )
    );

    expect(missing).toEqual([]);
  });

  it('finds every row site Relative renders, not just the first', () => {
    // Three: filler, placeholder, and the real rows. If this ever drops, the
    // parse above has stopped seeing them and the assertion is hollow.
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/frontend/components/Standings/Relative.tsx'
      ),
      'utf8'
    );
    expect(rowSites(source).length).toBeGreaterThanOrEqual(3);
  });
});
