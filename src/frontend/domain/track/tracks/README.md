The checked-in `by-id/<TrackID>.json` files are the source of truth for track
drawings. Each file contains one layout, formatted with two-space indentation
and a trailing newline so updates can be reviewed as individual track diffs.
There is no combined track-drawing file or build-time splitting step.

`npm run generate-track-json` regenerates these source files from the SVGs in
`asset-data/`. `npm run generate-assets` also refreshes them. The generator leaves
unchanged files alone and removes IDs no longer present in its output. Analysis
and radar pole-side tools read the same per-track files. The data license in
`LICENSE` applies to all drawings.

Generation still applies `tools/tracks/overrides/<TrackID>/*.svg` in preference
to downloaded SVG layers, and `start-point.json` supplies manual start/finish
coordinates. The direction corrections in `tools/svg-utils.ts` also remain in
effect. These corrections are baked into each source file before it is written.

`asset-data/tracks.json` is the downloaded iRacing asset catalogue used to fetch
SVGs, not the removed combined drawing file; the download scripts still use it.
Radar pole-side corrections are separate: generation preserves `verified` and
`reported` entries and track-name exceptions in `src/types/radarPoleSides.json`,
while user corrections remain in their existing application-data file.

Renderer code uses `loadTrackDrawing` / `useTrackDrawing`. Vite's lazy glob emits
one packaged chunk per layout, and a window loads only the drawings its mounted
consumers request. Concurrent consumers share a promise; the module cache retains
visited drawings until the window closes. Unknown IDs and chunk failures resolve
to `null`. Track changes hide the old drawing immediately and late responses
cannot replace the current track.

The landing site's preview reads only its demo track's source file and replaces
the loader with that single drawing.
