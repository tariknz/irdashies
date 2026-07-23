# Split Tachometer and Shift Lights

Status: implementation plan only

Architecture phase: Phase 2, primarily A4 (widget registration) and A6
(versioned settings/migrations)

## Goal

Split the current `tachometer` widget into two independently placeable widgets:

- `tachometer`: numeric RPM plus oil/water temperatures and engine-temperature
  warnings.
- `shiftlights`: LED bar, car-specific LED patterns, rev-limit blinking, and the
  custom per-car/per-gear `SHIFT` alert.

The split must preserve existing dashboards and custom shift points across every
profile. It must not introduce widget-to-widget imports or a new IPC bridge.

## Sanity-check verdict

The ownership split is sound and is cleaner than keeping shift-light behavior as
an optional mode of the tachometer. Moving all shift-related behavior, including
custom shift points, avoids leaving a hidden dependency where the tachometer
still changes at a shift threshold.

The following corrections and decisions are required before implementation:

1. **Registration is an architecture gate.** `ARCHITECTURE_RULES.md` requires a
   self-registering `WidgetDefinition`, but this checkout still uses
   `WidgetIndex.tsx`, `SettingsLoader.tsx`, `menuItems.ts`,
   `widgetConfigs.ts`, and `defaultDashboard.ts`. Do not silently bundle the
   full Phase 2 A4 registry migration into this feature. Prefer landing A4/A6
   first. If this feature must land first, get an explicit maintainer exception
   and use the current registration list documented below.
2. **The current shift-RPM telemetry lookup is suspect.**
   `useTachometerData.tsx` casts `DriverCarSLShiftRPM` and
   `DriverCarSLBlinkRPM` to `keyof Telemetry`, but the generated telemetry type
   contains `PlayerCarSLShiftRPM` and `PlayerCarSLBlinkRPM`. `DriverCarSL*`
   exists under session `DriverInfo`, not as typed telemetry. Characterize the
   current fallback behavior first, then either preserve it during the split or
   make the source correction as a separately called-out behavior fix with
   tests. Do not retain the unsafe cast in new code.
3. **Temperature placement is coupled to the LED container.** Oil and water
   boxes are absolutely positioned relative to `#ledcontainer`. Removing that
   element without adding a tachometer-owned relative layout anchor will move or
   hide the temperature displays.
4. **Car data is not network-asynchronous.** `carData.ts` synchronously reads a
   bundled JSON import. The hook publishes it from an effect, so one fallback
   render can still occur, but there is no remote loading state to design for.
5. **`rpmOrientation` describes the RPM/SHIFT box relative to the LED bar.** It
   is not an intrinsic orientation of a standalone tachometer. Use the legacy
   value during migration and remove it from the new tachometer config. If the
   new `SHIFT` pill remains positioned relative to the LED bar, map the value to
   a `shiftIndicatorPosition` setting on `shiftlights`.
6. **The old custom-shift implementation has conflicting behavior.**
   `TachometerComponent` ignores a car config's nested `enabled` flag, while the
   currently unused and tested `useCustomShiftPoints` hook respects it. Decide
   explicitly. Recommended behavior is to respect both the global and per-car
   flags and identify this as a small bug fix in the PR.
7. **Do not promise a pixel-identical automatic layout.** One widget is becoming
   two independently draggable rectangles. The migration can preserve the LED
   bar's old rectangle and choose a deterministic adjacent rectangle for the
   tachometer, but it cannot know an ideal free position on every multi-display
   dashboard.

## Behavior contract

### Tachometer

The standalone tachometer owns:

- Rounded numeric RPM text.
- Optional oil temperature and warning color.
- Optional water temperature and warning color.
- Background opacity.
- `showOnlyWhenOnTrack` and `sessionVisibility`.

It must never render `SHIFT`, inspect custom shift points, calculate LED
thresholds, or blink at a rev limit.

Use a `relative w-full h-full` tachometer-owned root as the positioning anchor
for the RPM and temperature boxes. This keeps temperature placement valid even
when RPM text is disabled. Retain the existing top/bottom and left/right offset
semantics, but make the offsets relative to the tachometer root rather than an
LED element.

For newly created dashboards, default `showRpmText` to `true`. During migration,
preserve the saved value, including `false`; existing users should not suddenly
gain an RPM readout. Existing temperature defaults remain enabled.

### Shift Lights

The standalone shift-lights widget owns:

- Horizontal LED bar and LED count.
- Car/gear-specific thresholds and colors from bundled lovely-car-data.
- Generic threshold/color fallbacks.
- Solid shift state and blinking rev-limit state.
- Custom per-car/per-gear shift thresholds.
- The custom `SHIFT` pill and its glow, border, or pulse styling.
- Background opacity.
- `showOnlyWhenOnTrack` and `sessionVisibility`.

Version 1 should keep the LED bar horizontal. A vertical LED-bar mode is a new
feature, not part of this extraction. `shiftIndicatorPosition` may use
`'right' | 'top' | 'bottom'`; map legacy `rpmOrientation` values as follows:

| Legacy value        | Shift indicator position |
| ------------------- | ------------------------ |
| `horizontal`        | `right`                  |
| `top`               | `top`                    |
| `bottom` or missing | `bottom`                 |

The `SHIFT` styles apply to a dedicated indicator pill, never to tachometer RPM
text. Use Phosphor caret icons when moving the expandable car settings; do not
carry the `▼`/`▶` glyph buttons into new client UI.

### Threshold compatibility contract

Before moving the logic, add characterization tests for the exact current
ordering:

1. Clamp RPM to `0..maxRpm`.
2. If car/gear thresholds exist, element `0` supplies the current effective
   shift and blink threshold; elements `1..N` supply individual LED thresholds.
3. Otherwise use the iRacing shift value, then `maxRpm * 0.9`.
4. Otherwise use the iRacing blink value, then `maxRpm * 0.97`.
5. Determine LED count from `carData.ledNumber`, then the car color-array
   convention, then `10`.
6. At or above blink RPM, active LEDs alternate purple/white.
7. At or above shift RPM, active LEDs are solid purple.
8. Below shift RPM, prefer car colors (including ARGB-to-RGB conversion), then
   use the generic green/yellow/red pattern.
9. RPM `0` lights no LEDs.

The current use of car threshold element `0` for both shift and blink may be
intentional compatibility or an existing defect. Preserve it in the extraction
PR unless a separately reviewed test defines different behavior. Also add guards
for malformed car data and LED counts of three or fewer so fallback threshold
math cannot divide by zero.

## Proposed code shape

Use primitive props at the memoized presentation boundary. Keep calculations
pure and testable.

```text
src/frontend/domain/shiftLights/
├── shiftLightModel.ts
└── shiftLightModel.spec.ts

src/frontend/components/ShiftLights/
├── ShiftLights.tsx
├── ShiftLights.stories.tsx
├── ShiftLights.spec.tsx
├── components/
│   ├── ShiftLightsComponent.tsx
│   └── ShiftLightsComponent.spec.tsx
└── hooks/
    ├── useShiftLightsData.tsx
    └── useShiftLightsSettings.tsx
```

Add an `@irdashies/domain/*` TypeScript path alias if the Phase 2 registry work
has not already added it. Do not import anything from the Tachometer folder.

`shiftLightModel.ts` should contain pure functions for:

- Clamping RPM and resolving effective thresholds.
- Resolving LED count.
- Resolving per-index activation thresholds and active state.
- Normalizing bundled ARGB colors.
- Resolving the color for one LED.
- Resolving the current custom shift point from settings, car ID/path, and gear.

Avoid returning freshly allocated object graphs on every telemetry tick. The
component can calculate the small fixed LED set with memoized primitive inputs,
and each memoized LED should receive primitive props. Capture React Profiler
results at full telemetry rate as required by the architecture checklist.

`useShiftLightsData.tsx` should subscribe to:

- `RPM` and `Gear`.
- A valid, typed shift/blink source selected after resolving the telemetry issue
  above.
- `DriverCarRedLine` and player `CarPath` from the session store.
- Bundled car data and the current gear's threshold array.

No new Zustand store, processor, channel, or IPC bridge is justified for this
extraction. Both widgets subscribing to RPM is acceptable initially. Use the
rounded scalar hook where it does not change threshold-crossing behavior, in
accordance with R2.2; integer/bitfield values such as gear and engine warnings
use exact subscriptions. Do not introduce a shared store solely to avoid two
small selectors.

Refactor `useTachometerData.tsx` so it returns only RPM/max-RPM, temperatures,
and warnings. `useCarTachometerData.tsx` should move to the shift-light domain
or be renamed so the Tachometer folder does not become a dependency. The unused
`useCustomShiftPoints.tsx` and its tests should either be folded into the new
domain model or deleted after equivalent coverage exists.

## Settings shapes

The final types should be equivalent to:

```ts
interface TachometerConfig {
  version: 2;
  showRpmText: boolean;
  oilTemp?: {
    enabled: boolean;
    position: 'top' | 'bottom';
    edgeOffset?: number;
  };
  waterTemp?: {
    enabled: boolean;
    position: 'top' | 'bottom';
    edgeOffset?: number;
  };
  tempLayout?: { swapSides: boolean };
  background: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}

interface ShiftLightsConfig {
  version: 1;
  shiftIndicatorPosition: 'right' | 'top' | 'bottom';
  shiftPointSettings: ShiftPointSettings;
  background: { opacity: number };
  showOnlyWhenOnTrack: boolean;
  sessionVisibility: SessionVisibilitySettings;
}
```

Remove the unused legacy `shiftPointStyle` field. Move
`shiftPointSettings` from `TachometerConfig` to `ShiftLightsConfig`; keep the
shared `ShiftPointSettings` type in `src/types/widgetConfigs.ts`. Do not create a
second copy in a widget folder. `src/frontend/components/Settings/types.ts`
already contains a stale duplicate custom-shift type; remove or update it only
if it is confirmed unused by a full `rg` check.

Split `TachometerSettings.tsx`:

- Tachometer settings retain RPM, temperature, opacity, and visibility controls.
- Shift Lights settings receive custom shift points, indicator style/color,
  opacity, indicator position, and visibility controls.
- Use a separate local-storage tab key such as `shiftLightsTab`.
- Change descriptions that currently say custom shifts appear “on the
  tachometer.”

## Dashboard migration

This is a structural dashboard migration, not only a deep merge. It must run
before `deepMergeConfig`, because deep merge cannot move data between widgets
and deliberately preserves unknown saved keys.

Implement a pure, idempotent migrator with `unknown` boundary guards, plus a
storage-level startup runner. Suggested locations after A6 are:

```text
src/types/migrators/splitTachometerShiftLights.ts
src/types/migrators/splitTachometerShiftLights.spec.ts
```

Migration algorithm for every saved dashboard/profile:

1. Find the legacy tachometer widget using `(widget.type ?? widget.id) ===
'tachometer'`.
2. Read and validate its legacy `shiftPointSettings`; invalid values fall back
   to new Shift Lights defaults and log one warning at the storage boundary.
3. If no corresponding Shift Lights widget exists, create one. Use
   `id: 'shiftlights'` for the standard `id: 'tachometer'` instance. If custom
   instances are supported, use a deterministic collision-safe ID derived from
   the source instance and set `type: 'shiftlights'`.
4. Copy `enabled`, `background`, `showOnlyWhenOnTrack`, and
   `sessionVisibility` to Shift Lights. Deep-clone custom car configs so later
   edits cannot alias the old object.
5. Copy `shiftPointSettings` and map `rpmOrientation` to
   `shiftIndicatorPosition`.
6. Remove `shiftPointSettings`, `shiftPointStyle`, and `rpmOrientation` from the
   persisted tachometer config, then set its new version.
7. Preserve the old layout exactly on Shift Lights, because the LED bar was the
   dominant old visual.
8. Give Tachometer a deterministic adjacent layout based on the legacy
   orientation: right for `horizontal`, above for `top`, below for `bottom` or
   missing. Use a fixed gap and ensure the two rectangles do not overlap. Exact
   sizing should be finalized in Storybook before freezing migration fixtures.
   Do not clamp coordinates to zero; valid secondary displays can have negative
   coordinates.
9. If a Shift Lights widget already exists, never overwrite its config or
   layout. Only remove legacy tachometer fields after confirming data has a
   destination.
10. If no legacy tachometer exists, let normal default-widget creation add a
    disabled Shift Lights widget.

Run the structural migrator over the complete `dashboards` record once during
startup, before `getOrCreateDefaultDashboard()` processes the active profile.
Write the record once only if at least one profile changed. Also run the pure
migrator on imported dashboard JSON before it is saved. Keeping this in the
startup window avoids adding new synchronous runtime I/O; do not add direct
`fs.*Sync` calls.

Migration tests must cover:

- Enabled and disabled legacy tachometers.
- Saved `showRpmText: false`.
- Missing/partial config and missing car data.
- Custom car/gear shift points and per-car disabled state.
- All three legacy orientations and non-overlapping output layouts.
- Existing Shift Lights config winning over legacy data.
- Idempotence: a second migration returns an equivalent dashboard and does not
  add another widget.
- Two or more profiles in the stored dashboards map.
- Imported legacy dashboard JSON.
- Custom widget instance IDs if the app officially supports multiple instances.

## Registration work

### Preferred path: WidgetDefinition is available

Export definitions for both widgets. The Shift Lights definition owns its
component, settings component, display name, defaults, and settings version.
The Tachometer definition is updated to its version 2 defaults. Do not edit the
old central registration files on this path.

### Temporary current-repository path (requires maintainer exception)

If A4 has not landed and an exception is granted, update all of the following:

- `src/frontend/WidgetIndex.tsx`
- `src/types/widgetConfigs.ts`
- `src/types/defaultDashboard.ts`
- `src/frontend/components/Settings/SettingsLoader.tsx`
- `src/frontend/components/Settings/menuItems.ts`
- `src/frontend/constants/widgetNames.ts`
- `src/app/webserver/componentServer.ts` (`/components` list)
- `site/src/components/PreviewSettingsMenu.tsx`
- README widget descriptions/screenshots, if this PR updates documented UI

Also check keybinding/widget-toggle code that derives IDs from `WidgetConfigMap`;
the typed map should make most of it automatic.

## Implementation sequence

1. Resolve the registration gate and the valid iRacing shift/blink source.
2. Add characterization tests around current LED, custom-shift, temperature, and
   layout behavior before moving code.
3. Add versioned config types/defaults and the pure structural migrator tests.
4. Implement and wire the migration before default deep merge; verify all
   profiles and import paths.
5. Extract the pure shift-light domain model without changing rendering.
6. Build the Shift Lights presentation/widget and move custom shift settings.
7. Simplify Tachometer and give temperature boxes their own layout anchor.
8. Register both widgets using the chosen registration path.
9. Split and update Storybook stories and component tests.
10. Run focused tests, then full typecheck/lint/tests, and perform Storybook and
    React Profiler checks.

Keep the structural migration and visual extraction in reviewable commits even
if they ship in one PR. Do not mix in the full channel-bus/processor migration.

## Verification matrix

Automated coverage:

- Tachometer only, Shift Lights only, both enabled, neither enabled.
- RPM text enabled/disabled; each temperature enabled/disabled; warning bits.
- Generic fallback LEDs and several car-specific LED counts/patterns.
- Missing/malformed bundled car data.
- Custom shift disabled globally, disabled per car, below threshold, at
  threshold, neutral/reverse, and unconfigured gear.
- Shift RPM, blink RPM, falling below blink threshold, and timer cleanup on
  unmount.
- Session visibility and `showOnlyWhenOnTrack` for each widget independently.
- Migration and multiple-profile cases listed above.

Manual verification:

- Storybook at small, default, and wide rectangles.
- All three `SHIFT` indicator positions and styles.
- Temperature positioning when RPM text is hidden.
- Edit-mode dragging/resizing with both widgets close together.
- Existing dashboard fixture before/after migration on primary and negative-X
  secondary-display coordinates.
- React DevTools Profiler at full telemetry rate; record render frequency in the
  PR description.
- iRacing verification only if actually performed; otherwise leave that PR
  checklist item unchecked.

Suggested commands:

```bash
npm run test -- --no-coverage
npm run lint
npm run storybook
```

Use the exact package script for typechecking if one exists at implementation
time; do not invent a PR checklist result.

## Explicit non-goals

- No new IPC bridge, channel, processor, or Zustand store.
- No full telemetry channel-bus migration.
- No vertical LED-bar feature in version 1.
- No changes to lovely-car-data fetching/bundling.
- No redesign of all widget registration unless Phase 2 A4 is intentionally
  taken as a separate prerequisite.
- No claim of pixel-perfect automatic placement after converting one saved
  rectangle into two.

## Definition of done

- Tachometer contains no LED, blink, car-pattern, custom-shift, or `SHIFT` code.
- Shift Lights contains all shift-related behavior and has no import from the
  Tachometer folder.
- Existing custom shift points survive migration for every profile.
- The migration is idempotent and preserves an already-configured Shift Lights
  widget.
- Temperature displays remain correctly anchored without an LED container.
- Invalid telemetry-key casts are gone or explicitly deferred behind a tested
  compatibility decision.
- Both widgets have settings, stories, tests, defaults, display names, and
  registration through the approved path.
- Architecture pre-PR checklist is completed, with the relevant Phase 2 work
  called out in the PR description.
