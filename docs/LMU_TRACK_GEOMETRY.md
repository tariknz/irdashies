# Contributing LMU track geometry

irdashies ships learned Le Mans Ultimate track geometry in
`src/app/lmu/lmu-track-geometry.json`: LMU's own racing line (from its REST
`/rest/watch/trackmap`) and the road edges learned from `mPathLateral` and
`mTrackEdge`. A track in that file gets the exact track map and clean radar road
edges from the first frame, for every user, instead of being learned again on
each machine.

On a track that is not in the bundle (a new layout), or whose road edges no
longer fit because LMU changed its lap length by more than 2 m, every session
learns the edges into the user's own cache. On a bundled track the bundle is
the only source, and nothing is learned or saved once the first live samples
confirm it (see "How the app uses it" below for when it is dropped instead, and
for `IRDASHIES_LMU_LEARN`). This page is how to turn a good cache into a bundled
entry.

## 1. Record a good sample

1. A track not in the bundle learns by itself. To re-record a bundled track,
   for example after LMU changed it, start irdashies with the environment
   variable `IRDASHIES_LMU_LEARN=1`; the log says so at start.
2. Drive the track offline with a full AI field for 20-30 minutes. AI cars
   drive more varied lines than a lone driver and report their track edges, so
   both sides of the road fill in quickly.
3. In the irdashies log, look for the track-width save line:

   ```
   [lmuTrackWidth] Saved track width for <track>: 84% of the lap with both edges measured or interpolated, 92% with both smoothed edges; ...
   ```

   Aim for 85% or more "with both smoothed edges" and 20% or more "with both
   edges measured or interpolated". Keep driving if it is lower; the cache
   keeps improving. LMU reports a car's edge about five times a second, 10 to
   16 m apart at racing speed; when a car stays on the same side between two
   readings less than 20 m apart, the stretches in between are filled from
   them, so one lap along each edge covers nearly the whole lap.

4. Quit irdashies (it saves what it learned on the way out) and copy
   `%APPDATA%\irdashies\lmu-world-tracks.json`. The file holds geometry only:
   no names or other personal data.

## 2. Export it

```bash
npm run lmu:export-geometry -- path/to/lmu-world-tracks.json [more files...] --sectors path/to/main.log
```

Options: `--out <file>` writes somewhere other than
`src/app/lmu/lmu-track-geometry.json`; `--date <yyyy-mm-dd>` sets the creation
date recorded in the entry; `--sectors <log>` (repeatable) reads the
`Learned sector boundaries for <track>: S2 ..., S3 ...` lines of an irdashies
log and bundles the median of each track's readings, also for tracks with no
geometry yet.

A track whose file has no learned width yet is bundled as its shape only, which
already gives the exact map and radar road; it never replaces a bundled entry
that has widths. A track with a width is refused unless:

- the track width is of the current version and LMU's lateral sign is decided;
- 85% or more of the lap has both smoothed edges;
- 20% or more of the lap has both edges measured or interpolated;
- it holds at least 2000 samples;
- its racing line is within 5% of LMU's lap length.

Several files for the same track are merged when they agree on the lap length
(within 2 m), the lateral sign, the racing line (length within 0.5%, no point
more than 2 m from the reference), and where the lap starts on it (within
2 m). A file that disagrees is left out and
named in the report.

Tracks already in the bundle are kept unless a new file replaces them.

## 3. Read the report, then commit

```
Test Oval: added (2 files, 61026 samples, 100% measured / 100% smoothed with both edges, 27 KB)
Thin Oval: refused - measured both-sided coverage 17% is under 20%
Bundle: 2 tracks, 53 KB
```

For a track already in the bundle, the report gives the largest change in its
road edges. A large change on a track that was fine deserves a look before
committing. Commit `src/app/lmu/lmu-track-geometry.json` on a branch; the
bundle only changes through this tool and a reviewed commit.

## How the app uses it

- Track map and radar road, first match wins: the bundle, the user's own
  cache, then a map saved from a recorded lap, else one is recorded from the
  next lap. The live REST track replaces them once it arrives, unless it is
  the same track. A cached copy that differs from the bundle is ignored, so a
  corrected bundle reaches every user. Track names match whatever their case
  and spacing. The cache must match LMU's live lap length within 2 m; the
  bundled racing line is used while the bundled lap is within 5% of it,
  stretched to the live lap when it is more than 2 m off, and its road edges
  then are not.
- The caches (`lmu-world-tracks.json`, `lmu-track-maps.json`) are read once
  when the LMU bridge starts and written in the background a couple of seconds
  after a change, and on the way out.
- Road edges on a bundled track come from the bundle alone. Live samples check
  each edge on its own: as soon as 100 samples on one side put that edge more
  than 1.5 m (median) from the bundle, the bundle is dropped, the session
  learns live (deciding LMU's lateral sign afresh) and saves to the cache, and
  the log says so, which usually means LMU changed the track. Once both sides
  have 100 samples within 1.5 m, learning stops for the session and nothing is
  saved.
- Sector boundaries on a bundled track come from the bundle and are not
  learned.
- A track not in the bundle starts from the user's cache and learns road edges
  and sector boundaries live.
- `IRDASHIES_LMU_LEARN=1` learns on bundled tracks too, starting from the
  cached road edges before the bundle's when the cache holds the bundled
  racing line. Cached road edges get the same live check as the bundle: when
  they disagree they are dropped and learned again.

## Look at it as SVG

```bash
npm run lmu:track-svgs
npm run lmu:track-svgs -- --track "Autodromo Enzo e Dino Ferrari" --out some/folder
```

Writes one SVG per bundled track to `out/lmu-track-svgs/` (or `--out`), built
from the bundle with the app's own code: the road between its learned edges
(or a fixed 12 m road for a track with only its shape), the LMU racing line,
the pit lane, the start/finish and sector lines, the direction of travel, and
the corner names from the LMU corner data (the iRacing data through the track
aliases where LMU has none). `--bundle <file>` reads another bundle, such as a
new export before it is committed.

The picture keeps LMU's own axes, x to the right and LMU's -z down the page,
the same as the app's track map. LMU's +z points north (checked against the
real Barcelona circuit), so north is at the top. Many circuit drawings are
turned to fit their page, so a map may look rotated against them.
