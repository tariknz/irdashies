The checked-in `by-id/<TrackID>.json` files are the source of truth for track
drawings. Each file contains one layout, formatted with two-space indentation
and a trailing newline so updates can be reviewed as individual track diffs.
There is no combined track-drawing file or build-time splitting step.

`npm run generate-track-json` regenerates these source files from the SVGs in
`asset-data/`. `npm run generate-assets` also refreshes them. The generator leaves
unchanged files alone and removes IDs no longer present in its output. Analysis
and radar pole-side tools read the same per-track files. The data license in
`LICENSE` applies to all drawings.

Renderer code uses `loadTrackDrawing` / `useTrackDrawing`. Vite's lazy glob emits
one packaged chunk per layout, and a window loads only the drawings its mounted
consumers request. Concurrent consumers share a promise; the module cache retains
visited drawings until the window closes. Unknown IDs and chunk failures resolve
to `null`. Track changes hide the old drawing immediately and late responses
cannot replace the current track.

The landing site's preview reads only its demo track's source file and replaces
the loader with that single drawing.
