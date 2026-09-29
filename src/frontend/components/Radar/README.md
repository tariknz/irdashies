# Radar widget

A proximity radar: the player's car sits at the centre of a disc pointing up.
iRacing publishes no per-car world position, so moving blips use lap distance
projected onto the track centreline. On a standing two-column grid, iRacing's
pace row/line identifies each slot; the lane offset is projected from the local
road direction into the radar's lateral and longitudinal axes. During racing,
same-progress rivals that would otherwise occupy the same pixels are fanned out
in a stable visual order; that separation prevents overdraw but does not claim
to know their real left/right positions.

Everything the widget owns lives in this folder. Nothing here imports from
another widget folder, and the only things outside it that name the widget are
the registration entries listed below.

## Layout

| File                                    | Role                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Radar.tsx`                             | The widget: visibility gate, fade, demo blips, and the hand-off to the disc.                                                         |
| `hooks/useRadar.tsx`                    | Turns the `radar.snapshot` and `blind-spot.snapshot` channels plus the session into blips.                                           |
| `hooks/useRadarSettings.tsx`            | Reads and normalises the widget config, including the `showRange` ceiling the settings UI cannot express.                            |
| `hooks/useRadarFade.ts`, `radarFade.ts` | Frame-rate independent fade in and out.                                                                                              |
| `hooks/useRadarMotion.ts`               | Smooths blip positions between frames and owns the single paint per snapshot.                                                        |
| `radarBlips.ts`                         | Projects lap distances; applies grid rows/columns, overlap placement, and pace-car positioning.                                      |
| `overlapSides.ts`                       | The sim's own left/right verdict, widened into the four windows a car length drives.                                                 |
| `gridLayout.ts`                         | Reads starting-grid rows and columns from iRacing pace telemetry.                                                                    |
| `components/RadarDisplay.tsx`           | The canvas: disc, range rings, road segment, vehicles, overlap arcs.                                                                 |
| `widgetRuntimeDefinition.ts`            | Declares the channels and rates. Found by the `import.meta.glob` in `src/frontend/widgetRuntime.tsx`, so nothing imports it by path. |
| `radarCapture.spec.ts`                  | Replays recorded captures and checks the blips against the recorded positions.                                                       |

## Channels and processor

- `radar.snapshot` (`src/types/channels/channel.ts`) is published by
  `src/app/processors/RadarProcessor.ts` and carries per-car lap distance, pit
  state and pace row/line at full precision. Processors live in `src/app/` by
  rule R5, so the file is outside this folder by design.
- `blind-spot.snapshot` supplies the overlap verdict. The radar is a consumer of
  that channel, not of the Blind Spot Monitor widget.

## Removing the widget

Everything the widget owns is in this folder, so deleting it is the folder plus
the entries below. Line numbers are from the branch that introduced this file.

**Delete outright**

- `src/frontend/components/Radar/` (this folder)
- `src/app/processors/RadarProcessor.ts` and `RadarProcessor.spec.ts`
- `src/frontend/components/Settings/sections/RadarSettings.tsx` and its spec
- `tools/perf/radarGeometry.ts` (imports `radarBlips` and `overlapSides`),
  `tools/perf/radarLateralNoise.ts` (measures the shared centreline filter this
  widget motivated)
- `test-data/road-atlanta-grid/` — read only by `radarCapture.spec.ts`

**Registration entries, one per line**

| File                                                  | What                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/frontend/WidgetIndex.tsx`                        | import (11), re-export (44), `WIDGET_MAP` entry (75)                                       |
| `src/frontend/components/Settings/SettingsLoader.tsx` | import (18), `case 'radar'` (88-89)                                                        |
| `src/frontend/components/Settings/menuItems.ts`       | settings menu entry (151-156)                                                              |
| `src/frontend/constants/widgetNames.ts`               | `radar: 'Radar'` (18) — required by `Record<WidgetId, string>`                             |
| `src/types/widgetConfigs.ts`                          | `RadarConfig` (492-550), `WidgetConfigMap` entry (1020), `RadarWidgetSettings` (1124)      |
| `src/types/defaultDashboard.ts`                       | default widget entry (1080-1123)                                                           |
| `src/types/channels/channel.ts`                       | `ChannelPayloads` entry (20), `RadarSnapshot` (127-158), `channelRegistry` entry (484-488) |
| `src/app/processors/processorRegistry.ts`             | import (19), `defineProcessor` block (120-123)                                             |
| `src/app/webserver/componentServer.ts`                | `'radar'` in the `/components` list (405)                                                  |
| `site/src/components/PreviewSettingsMenu.tsx`         | site preview menu entry (32)                                                               |
| `src/types/performance.ts`                            | `'radarAnimationFrame'` in `RENDERER_PERF_MEASURES` (47)                                   |
| `package.json`                                        | `perf:radar-geometry` (38), `perf:radar-lateral-noise` (39)                                |

**Test infrastructure that names the widget**

- `.storybook/captureSnapshots.ts` — builds the radar snapshot for stories
  (11, 82, 91, 105)
- `src/testing/renderWithFixture.tsx` — runs the radar processor in the
  fixture harness (16, 95, 100, 121, 126)
- `src/frontend/widgetRuntime.spec.tsx` — the widget id list (47) and the radar
  definition assertions (97-108)
- `src/runtimeBoundaryReplay.spec.ts` — `radar.snapshot` in the channel list
  (43), its payload projections (516-521) and mock (752-757)

**Docs**

- `README.md` — the `### Radar` section (348-366)
- `docs/PERFORMANCE_BENCHMARKS.md` — the two radar benchmark sections
  (265-330) and the `filteredTrackPathPoints` rows (354-359)

**Shared code that mentions the widget in prose only** — the code is shared
with the track map and stays, but the wording goes stale: the module docs in
`src/frontend/domain/trackGeometry.ts` and `progressInterpolator.ts`, and the
radar-worded assertions in `src/frontend/domain/trackGeometry.spec.ts`.
