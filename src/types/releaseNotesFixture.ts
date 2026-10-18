import type { ReleaseNotes } from './releaseNotes';

/** Local preview data; never used in a packaged app. */
export const releaseNotesFixture = (version = '2.1.0'): ReleaseNotes => ({
  version,
  title: `irDashies ${version}`,
  url: `https://github.com/tariknz/irdashies/releases/tag/v${version}`,
  publishedAt: '2026-10-18T00:00:00Z',
  body: `## What's new

- View release notes in Settings whenever you need them.
- See what's changed after an update, with a preference to turn this off.

## Improvements

**Standings and relative overlays** feel more responsive on large grids.

| Area | Change |
| --- | --- |
| Settings | Easier access to release information |
| Updates | Notes for the version you installed |

## Fixes

- Fixed an issue with saving layout preferences.
- Improved recovery after a simulator disconnect.

Read more on [GitHub](https://github.com/tariknz/irdashies).

\`\`\`text
This is sample content for local testing.
\`\`\`
`,
});
