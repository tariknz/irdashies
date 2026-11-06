# Settings window default and one-time bounds transition

The old native Settings default was 800 × 700 and existing saved dimensions
overrode it. The new preferred outer window is 1280 × 800 **logical** pixels
(Electron DIP), bounded independently to 90% of the PRIMARY monitor's usable
`workArea`:

```text
width  = max(1, min(1280, floor(workArea.width  * 0.9)))
height = max(1, min( 800, floor(workArea.height * 0.9)))
x = round(workArea.x + (workArea.width  - width)  / 2)
y = round(workArea.y + (workArea.height - height) / 2)
```

`workArea` excludes the taskbar/dock and supplies its actual origin, including
nonzero and negative coordinates. Full display bounds and `scaleFactor` do not
enter the formula. This is a default, not a maximum for user resizing. Later
intentional size/position changes restore normally, including on secondary
monitors; existing reachability checks still rescue off-screen rectangles.

## Transition scope and persistence

On first launch after the update, **all** pre-existing Settings bounds are
invalidated, rather than only the former 800 × 700 default. Old size and position
are both ignored so the new default centres in the primary usable area. Fresh
installs use the same default.

`src/app/storage/settingsWindowBounds.ts` uses the existing dedicated-file,
asynchronous, debounced atomic writer convention. It writes
`userData/settings-window-bounds.json` with `defaultSizeApplied: true` and optional
`bounds: { x, y, width, height }`. The old `config.json.settingsWindowBounds` key
is left inert, never consulted or imported. Leaving its bytes alone avoids
rewriting shared configuration to perform this narrow transition. Dashboard,
profile, overlay and unrelated preferences are not read or changed by the
transition. No general migration registry or settings version is introduced.

Startup awaits the one-shot load/marker write after Electron readiness and the
single-instance lock, before bridges, tray actions and normal window creation.
A second-instance request also awaits readiness and that same initialization.
Window construction reads the cache only. Concurrent/repeated initialization
shares one promise and never resets a subsequent user resize. Movement remains
debounced, and pending movement timers drain before the coordinated asynchronous
shutdown storage flush. Closing a window drains its pending timer while its
rectangle is readable; destroyed windows cannot leave timers that query them.

## Failure and restart behavior

- Marker and future bounds share one atomic file replacement. Exiting before
  replacement leaves the transition pending; next launch uses the new default
  and retries. Exiting after replacement cannot restore the inert legacy key.
  No default rectangle has to be persisted to complete the transition.
- Missing files are normal on fresh install/first upgrade. Invalid JSON, an
  invalid marker or malformed rectangle safely selects the default. Only a
  literal `true` completion marker enables restoration of valid finite bounds
  with positive dimensions. Invalid marker data is replaced atomically; a
  malformed rectangle with a valid marker can be replaced by a later user save.
- Write/rename failure logs a file name and error code, leaves the previous
  destination intact and retains dirty state for the next save/shutdown flush.
  There is no repeating retry loop. A later successful resize save commits its
  rectangle and the marker together. If no write succeeds, later launches may
  default again; durable resize preservation requires writable storage.
- A non-missing read I/O failure could hide a valid later user rectangle. Use the
  new default in memory but block writes for that process so the unreadable file
  survives; retry reading on next launch. Temporary changes in that session
  cannot be saved. Shared configuration is never overwritten on this failure.
- The existing writer uses temp-file replacement, not a power-loss durability
  guarantee. Uncommitted resize changes may be lost on forced termination.

## Small work areas and verification

There is no fixed application minimum. Integer dimensions have a one-pixel
floor, the unavoidable exception when 90% of a dimension is less than one pixel.
On extremely small logical work areas the desktop form/native controls cannot
all fit, and the OS may enlarge its native frame. This change does not add a
phone layout, change Widget Scale containment or change App settings navigation.
Native titlebar options and the actual logo/red identity remain unchanged.

Automated tests use only `mkdtemp` directories and mocked Electron windows. The
storage suite exercises real asynchronous reads, writes and atomic replacement;
the window suite connects that store to real `OverlayManager` construction and
movement tracking. Coverage includes fresh install, arbitrary legacy rectangles,
later restart restoration, repeated initialization/open calls, primary selection
with another display first, positive/negative origins, taskbar offsets, laptop,
small, ultrawide and portrait areas, unchanged logical geometry across scale
factors, secondary restoration, start-minimized, native titlebar options,
off-screen rescue, partial writes, rename/read errors and shutdown draining.
The existing bounds, movement, atomic writer, application-settings and manager
regression suites also run. Native interaction and live iRacing are not verified
by these mocked-window tests; the installed user's real profile is never used.

Verification for this change: **130 tests passed in 8 targeted files**:

```powershell
npx vitest run --project node src/app/windowBounds.spec.ts src/app/trackWindowMovement.spec.ts src/app/storage/settingsWindowBounds.spec.ts src/app/storage/debouncedAtomicWriter.spec.ts src/app/storage/appSettings.spec.ts src/app/overlayManager.spec.ts src/app/overlayManager.runningState.spec.ts src/app/overlayManager.settingsWindow.spec.ts
npm run lint
```

TypeScript and ESLint passed, as did Prettier checks for the changed source,
tests and this note, and `git diff --check`. No native application launch or
real-profile reset was performed.
