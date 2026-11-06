# Settings navigation alternatives

Research and isolated prototypes, 6 November 2026. Baseline: checkout head `d936a4ec54b2860df73666e91046267b80e6db5c`. The sections below preserve the research and prototype findings. The user subsequently selected E with the header profile picker and authorized implementation/publication in a separate PR; PR #880 remains untouched. The implementation is based on current main so later window and startup changes are retained.

## Recommendation

**Revised after user feedback: prefer E, a dedicated App settings workspace.** A persistent, labeled App settings link opens a complete view with General, Profiles, Key Bindings, Driver Tags and Setup Comparison in its own sidebar. The overlay catalog is absent from this view. Back to overlays returns to the previous overlay route and search. Advanced, Release notes and About belong to the App settings navigation. This uses the existing window, URLs and settings behavior; it uses the existing settings window rather than adding a native window.

**Latest Profiles refinement:** the user selects the current profile text under the logo as the entry point. The current candidate makes it a compact profile picker with a chevron, quick profile choices and Manage profiles… linking to the existing management page. It replaces the extra sidebar shortcut. Profiles remains accessible from the app sidebar. Switching consumes the existing dashboard-context action; the isolated story supplies two in-memory profiles and never touches installed data. Production profile/storage/IPC behavior is unchanged.

The earlier recommendation of C is superseded. It optimized destination visibility and geometry while leaving an irrelevant overlay sidebar beside app-level content. The user's reported confusion invalidates that recommendation even though its fit measurements remain correct. The [hierarchy follow-up](#hierarchy-follow-up-after-user-feedback) compares E with D, a top-level area switch and contextual sidebar, using additional primary guidance and real fixtures.

## First-round recommendation (superseded)

Prefer **C: a persistent horizontal App row beneath the existing window header**, containing General, Profiles, Key Bindings, Driver Tags and Setup Comparison. Keep the searchable alphabetical overlay catalog and its switches in the left sidebar, with Advanced, Release notes and About at the bottom.

This directly exposes the five destinations the current disclosure conceals. In the rendered compact fixture it costs 49px of main-page height, preserves the 544px form width, and leaves a 287px overlay scroller versus the baseline's 268px. A vertical App group leaves only 112px. These are geometry and task-path proxies, not participant success rates, usability scores or a guarantee that people will find the pages.

The recommendation is provisional. The user's report establishes a problem with the present disclosure; authoritative design guidance supplies candidate patterns; our measurements establish fit and costs. None substitutes for observing representative users attempt these tasks.

## Actual inventory and boundaries

Inventory sources: [`menuItems.ts`](../../src/frontend/components/Settings/menuItems.ts), [`SettingsLoader.tsx`](../../src/frontend/components/Settings/SettingsLoader.tsx), [`widget manifests`](../../src/types/widgets), [`simWidgetSupport.ts`](../../src/types/simWidgetSupport.ts) and [`simulators.ts`](../../src/types/simulators.ts). The prototype reads the current registry rather than maintaining a second list of destinations.

| Area   | Visible label    | Route                     |
| ------ | ---------------- | ------------------------- |
| App    | General          | `/settings/general`       |
| App    | Profiles         | `/settings/profiles`      |
| App    | Key Bindings     | `/settings/keybindings`   |
| App    | Driver Tags      | `/settings/driver-tags`   |
| App    | Setup Comparison | `/settings/car-setup`     |
| Bottom | Advanced         | `/settings/advanced`      |
| Bottom | Release notes    | `/settings/release-notes` |
| Bottom | About            | `/settings/about`         |

`/settings` redirects to General. The loader also resolves `/settings/:widgetId` to a dashboard instance's type, so instance URLs remain meaningful without adding an entry per instance. App and bottom routes have no simulator-dependent menu filtering. General includes preferences that affect overlays; “App” describes navigation scope, not a new storage boundary. Profiles, Driver Tags, key bindings and setup comparison retain their existing ownership and behavior.

### Widget catalog

There are **35 widget manifests, 30 sidebar entries**. Four broadcast children are reached through Broadcast page tabs. Telemetry Inspector is hidden from the menu and configured through Advanced, with no dedicated `WIDGET_SETTINGS` entry. Broadcast is a group page with no single sidebar switch. Other listed widgets have a sidebar switch only when their primary id exists in the dashboard. Manifest display names can differ from navigation labels; the table uses the actual navigation label.

| Navigation label                                       | Widget id / route suffix | Menu location                  | iRacing   | LMU default         |
| ------------------------------------------------------ | ------------------------ | ------------------------------ | --------- | ------------------- |
| Battle                                                 | `battle`                 | Overlay sidebar                | Supported | Supported           |
| Blind Spot Monitor                                     | `blindspotmonitor`       | Overlay sidebar                | Supported | Unsupported; hidden |
| Broadcast (manifest: Broadcast Tower)                  | `broadcast`              | Grouped Broadcast page         | Supported | Unsupported; hidden |
| Broadcast Events                                       | `broadcastevents`        | Broadcast tab; hidden menu row | Supported | Unsupported; hidden |
| Broadcast Podium                                       | `broadcastpodium`        | Broadcast tab; hidden menu row | Supported | Unsupported; hidden |
| Broadcast Ticker                                       | `broadcastticker`        | Broadcast tab; hidden menu row | Supported | Unsupported; hidden |
| Broadcast Weather                                      | `broadcastweather`       | Broadcast tab; hidden menu row | Supported | Unsupported; hidden |
| Car Systems                                            | `carsystems`             | Overlay sidebar                | Supported | Unsupported; hidden |
| Corner Names                                           | `cornername`             | Overlay sidebar                | Supported | Supported           |
| Delta Speed                                            | `deltaspeed`             | Overlay sidebar                | Supported | Supported           |
| Faster Cars Behind (manifest: Faster Cars From Behind) | `fastercarsfrombehind`   | Overlay sidebar                | Supported | Unsupported; hidden |
| Flag                                                   | `flag`                   | Overlay sidebar                | Supported | Supported           |
| Flat Track Map                                         | `flatmap`                | Overlay sidebar                | Supported | Unsupported; hidden |
| Fuel Calculator                                        | `fuel`                   | Overlay sidebar                | Supported | Unsupported; hidden |
| Gantry (manifest: The Gantry)                          | `gantry`                 | Overlay sidebar                | Supported | Unsupported; hidden |
| Garage Cover                                           | `garagecover`            | Overlay sidebar                | Supported | Supported           |
| Heart Rate                                             | `heartrate`              | Overlay sidebar                | Supported | Unsupported; hidden |
| Information Bar                                        | `infobar`                | Overlay sidebar                | Supported | Supported           |
| Input (manifest: Input Traces)                         | `input`                  | Overlay sidebar                | Supported | Supported           |
| Lap Timer                                              | `laptimelog`             | Overlay sidebar                | Supported | Supported           |
| Lap Trace                                              | `laptrace`               | Overlay sidebar                | Supported | Supported           |
| Pitlane Helper                                         | `pitlanehelper`          | Overlay sidebar                | Supported | Supported           |
| Radar                                                  | `radar`                  | Overlay sidebar                | Supported | Unsupported; hidden |
| Rejoin Indicator                                       | `rejoin`                 | Overlay sidebar                | Supported | Unsupported; hidden |
| Relative                                               | `relative`               | Overlay sidebar                | Supported | Supported           |
| Sector Delta                                           | `sectordelta`            | Overlay sidebar                | Supported | Supported           |
| Shift Light                                            | `shiftlight`             | Overlay sidebar                | Supported | Supported           |
| Slow Car Ahead                                         | `slowcarahead`           | Overlay sidebar                | Supported | Unsupported; hidden |
| Standings                                              | `standings`              | Overlay sidebar                | Supported | Supported           |
| Stream Chat                                            | `streamchat`             | Overlay sidebar                | Supported | Unsupported; hidden |
| Tachometer                                             | `tachometer`             | Overlay sidebar                | Supported | Unsupported; hidden |
| Telemetry Inspector                                    | `telemetryinspector`     | Advanced page                  | Supported | Supported           |
| Track Map                                              | `map`                    | Overlay sidebar                | Supported | Unsupported; hidden |
| Weather                                                | `weather`                | Overlay sidebar                | Supported | Supported           |
| Wind                                                   | `wind`                   | Overlay sidebar                | Supported | Unsupported; hidden |

### Simulator differences

Bundled defaults enable support for all 35 types under iRacing. Under Le Mans Ultimate, 16 types are supported, including the hidden Telemetry Inspector; **15 overlay entries** appear initially. Of 19 unsupported types, four are hidden broadcast children, leaving **15 hidden sidebar entries**. The existing `(15 hidden)` control reveals them dimmed with the compatibility explanation and without their switches. They remain navigable for inspection. With no detected simulator, no widgets are filtered. The last active simulator survives disconnect, while the header names it only when running.

Support is runtime configuration read through `getSimWidgetSupport`, with bundled defaults as the fixture input. Actual installations can have different support lists; these measurements do not read installed configuration. Hiding unsupported widgets never rewrites their saved enabled state. App pages remain present under both simulators. Setup Comparison is not evidence of equivalent setup data: the LMU session mapper currently supplies `CarSetup: { UpdateCount: 0 }`; no new data or support claim is introduced here.

## Primary guidance and our interpretation

All sources below were checked on 6 November 2026. These are official design/accessibility guidance, not comparative studies of this app. The Material pages were read in their rendered JavaScript UI so the current Expressive update was visible.

| Source and exact section                                                                                                                                                                                                                                                                                              | What the source supports                                                                                                                                                                                                                                                                                                                     | Design inference for irDashies                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Microsoft Windows NavigationView](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview), **Display modes → Top / Left**, **Adaptive behavior → Top to left navigation**, **Footer menu items**                                                                                          | Top navigation suits up to five equally important categories; expanded left navigation emphasizes roughly five to ten. Small windows require an explicit space/visibility tradeoff. Footer destinations are supported.                                                                                                                       | Five App links can occupy one labeled row here. This is an analogy to a subset of our navigation, not a claim that all 30 overlays should become top links or that Electron must use WinUI defaults. Keep service routes in their established position.                                                  |
| [Fluent 2 React Nav](https://fluent2.microsoft.design/components/web/react/core/nav/usage), **Structure and strategy**, **Grouping**, **Icons**, **Footer**, **Reflow and overflow**, **Content**                                                                                                                     | Plain, scannable, destination-specific labels and coherent navigation matter; search is supplementary. Groups and selected-state cues help express structure. Icon-only Nav is unsupported. Labels wrap. Its inline drawer becomes an overlay at small widths; footer space deserves particular care at high zoom.                           | Expose page names, preserve text beside icons, and keep App links independent of overlay search. Our 232/252px sidebar and measured 808px compact size are product choices, not Fluent's 260px/640px defaults. Three pinned bottom rows have a measurable space cost; do not add more without measuring. |
| [Material 3 navigation rail](https://m3.material.io/components/navigation-rail/overview), **Overview**, **M3 Expressive update**; [navigation drawer](https://m3.material.io/components/navigation-drawer/overview), same sections                                                                                    | Current rail guidance describes three to seven destinations and stable placement. The May 2025 Expressive update replaces the baseline rail with collapsed/expanded variants and recommends the expanded rail in place of the older drawer. The older drawer page still distinguishes standard and modal behavior and related-item grouping. | An expanded labeled rail is a defensible alternative for a small set of high-level areas. A 30-item icon rail would be a poor translation. We compare a labeled App/Overlays split without importing Material shapes, colors, mobile breakpoints or modal behavior.                                      |
| [W3C APG disclosure navigation example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/), **About**, **Accessibility Features**, **Keyboard Support**, **Role, Property, State**                                                                                                  | Navigation links need not be an ARIA menu. The example uses ordinary links, disclosure state, Tab, Escape recovery and current-page semantics; arrow-key support is optional. Examples require assistive-technology testing.                                                                                                                 | The present disclosure can have a valid keyboard contract while still hiding the destinations this user needs. Removing the disclosure removes that extra activation, not an alleged ARIA violation. Alternatives use normal links and native Tab order, with `aria-current="page"` on the destination.  |
| [W3C WCAG 2.2 bypass blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html), **Intent**; [focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), **Intent**; [target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), **Success Criterion** | Repeated navigation needs a bypass mechanism. Sequential focus must preserve meaning and operability. The pointer target minimum is 24 × 24 CSS px, subject to defined exceptions.                                                                                                                                                           | Keep the first Skip to settings link and current route-change focus behavior. Retain 36px navigation links and the existing 36 × 24px compact switches. These samples do not establish whole-app conformance.                                                                                            |

Disclosure is useful when saving space outweighs the need to expose choices. The current button is always visible, but the names Profiles, Key Bindings, Driver Tags and Setup Comparison are absent until opened. Renaming the same button would not resolve that structural issue. No source above establishes which app pages are most frequent for our users; the five-link order remains the registry order.

## Three realistic structures

### A — Persistent grouped links

App caption and all five links above Overlays; existing search and service links remain pinned. Both domains are continuously available in one column. This gives every app page one-activation access with familiar scan order and no extra horizontal band. It costs 156px of overlay-list height relative to the current closed disclosure. At compact size only three full overlay rows remain after revealing Relative. Search mitigates scrolling for known names; it does not restore browseable density. Prefer this only if a single navigation column proves substantially clearer and compact overlay browsing is uncommon.

### B — Explicit App / Overlays areas

Two persistent, text-labeled area links replace the disclosure. App opens General on first use and subsequently the most recent app page; Overlays returns to the latest overlay page, initially Relative. App mode exposes the five page links; overlay mode shows the searchable catalog. Bottom routes remain available in either area and have their own page indication. Area state is derived from the route; last destinations and search are local, in-memory UI state.

This preserves content height and overlay density, but exposes no specific app page names while viewing an overlay. First access to Profiles, Key Bindings, Driver Tags or Setup Comparison still takes two activations. Returning to the area can be efficient, but now depends on remembered context. Overlay search and switches are one area activation away while in App. It is a stronger separation model for users who naturally think in these two areas, but a weaker answer to the specific request to find app pages.

### C — Persistent top App links (first-round recommendation, superseded)

Keep product header actions and actual artwork unchanged. Add one horizontal App navigation row below the header, outside the native drag region. Remove the disclosure from the overlay sidebar. Keep the existing alphabetical catalog, search, support reveal, switches, current-route reveal and bottom links. App links stay available even with a no-match overlay search.

All five App links are visible in one line at all three requested viewports. The last link ends around x=639px in the current English fixture, within the 808px compact viewport. The row is 49px high, with 36px link targets and existing 13px navigation text. Main-page height decreases by 49px; sidebar overlay-list height increases by 19px because the removed disclosure occupied 68px. The prototype wraps instead of truncating or introducing an overflow disclosure if the labels no longer fit. Additional rows would require reassessing the height tradeoff.

## Explicit task paths and activation counts

An activation is a click or keyboard activation of a link/button. It excludes pointer travel, reading, typing, scrolling and elapsed time. Start at Relative, with the current disclosure closed, empty overlay search, and no previous App-area visit. Counts do not imply task completion quality.

| Destination                               | Current disclosure                     | A grouped               | B area split                                                                     | C top links             |
| ----------------------------------------- | -------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| General                                   | App settings → General: **2**          | General: **1**          | App → General landing: **1**                                                     | General: **1**          |
| Profiles                                  | App settings → Profiles: **2**         | Profiles: **1**         | App → Profiles: **2**                                                            | Profiles: **1**         |
| Key Bindings                              | App settings → Key Bindings: **2**     | Key Bindings: **1**     | App → Key Bindings: **2**                                                        | Key Bindings: **1**     |
| Driver Tags                               | App settings → Driver Tags: **2**      | Driver Tags: **1**      | App → Driver Tags: **2**                                                         | Driver Tags: **1**      |
| Setup Comparison                          | App settings → Setup Comparison: **2** | Setup Comparison: **1** | App → Setup Comparison: **2**                                                    | Setup Comparison: **1** |
| Each bottom page                          | Direct link: **1**                     | **1**                   | **1**                                                                            | **1**                   |
| Select a visible overlay from an app page | Overlay link: **1**                    | **1**                   | Overlays restores last page: **1**; a different overlay needs another activation | **1**                   |

B's returning App activation restores the last app route, so its one-activation destination changes with history. For A/C, all five app destinations and three service destinations are continuously exposed. For current/B in overlay mode, only the three service destinations are exposed by name; there is one App entry point. Overlay row availability is measured separately below.

## Rendered geometry

CSS pixels at device scale factor 1, real React/Storybook rendering. All measurements use the same Default profile fixture, Lato / Normal / Extra Small overlay preference ancestor, unchanged settings type roles, bundled support configuration and initial Relative route. The active route is revealed by the menu's actual scroller logic; we do not reset scroll to make the screenshot denser. “Rows” counts fully contained overlay link rectangles, excluding partial rows and support-reveal text. LMU results are below.

| Viewport    | Current list px / rows | A list px / rows | B overlay mode px / rows | C list px / rows |
| ----------- | ---------------------- | ---------------- | ------------------------ | ---------------- |
| 808 × 656   | 268 / 7                | 112 / 3          | 271 / 7                  | **287 / 7**      |
| 1280 × 800  | 412 / 10               | 256 / 6          | 415 / 10                 | **431 / 11**     |
| 1920 × 1080 | 692 / 18               | 536 / 14         | 695 / 18                 | **711 / 18**     |

| Viewport    | Sidebar width, every pattern | Form width, every pattern | Current / A / B main height | C main height |
| ----------- | ---------------------------- | ------------------------- | --------------------------- | ------------- |
| 808 × 656   | 232                          | 544                       | 576                         | 527           |
| 1280 × 800  | 252                          | 960                       | 720                         | 671           |
| 1920 × 1080 | 252                          | 960                       | 1000                        | 951           |

Main height includes its page gutters. A/C expose five 36px-high app links; A widths are 197px compact / 217px wider. C app targets are approximately 82, 80, 111, 101 and 144px wide. B's area targets are 40px high and approximately 101px wide compact. Overlay links remain at least 36px high and compact switch targets remain 36 × 24px. Narrower link text wraps where needed; some unsupported rows grow with their explanation. No switch is replaced by an icon-only shortcut.

| LMU viewport | A list px / full rows | B overlay mode px / full rows | C list px / full rows |
| ------------ | --------------------- | ----------------------------- | --------------------- |
| 808 × 656    | 112 / 3               | 271 / 7                       | 287 / 7               |
| 1280 × 800   | 256 / 6               | 415 / 10                      | 431 / 11              |
| 1920 × 1080  | 536 / 13              | 695 / 15                      | 711 / 15              |

LMU's reveal control consumes some scroll space, and its catalog has only 15 entries before reveal. B App mode has **zero** visible overlay rows; search and switches return when Overlays is selected. Geometry is viewport- and state-specific, not a predicted number of destinations that any user will notice.

## Keyboard and focus costs

The first focusable product control remains **Skip to settings**. From fresh document focus: **Tab, Enter** focuses `main#settings-content` for every pattern. Initial mount does not move focus; changing routes does. Filtering overlays and toggling them keep focus on the operated control. Selecting the already-current route does not manufacture a route change.

| iRacing Relative, empty search | Sequential stops before main, including skip/header | App destinations from fresh document focus                                                      |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Current, closed                | 67                                                  | 4 Tabs to disclosure, Enter, then 1–5 Tabs to destination, Enter                                |
| A grouped                      | 71                                                  | 4–8 Tabs, Enter                                                                                 |
| B overlay mode                 | 68                                                  | 4 Tabs, Enter opens General and focuses main; other pages require returning into App navigation |
| C top links                    | 71                                                  | 4–8 Tabs, Enter                                                                                 |

These totals include offscreen but tabbable overlay rows/switches. They exclude page form controls. The earlier UX document's 66 count excluded the skip control; this table includes it explicitly. A/C add four stops versus a closed disclosure. Their first page links are no farther down the initial Tab order, and the skip path prevents the larger nav from becoming mandatory traversal. Under LMU, A/C have 43 stops and B overlay mode 40, including the support-reveal control. B App mode has 13 stops and no overlay controls in the Tab sequence.

In B, after App opens General and route focus lands on main, Profiles requires seven Shift+Tabs then Enter; Key Bindings six, Driver Tags five, Setup Comparison four. This is an explicit sequential-keyboard path from the route-focused main, not a claim that a person using landmark shortcuts must traverse those stops. The existing route focus rule protects against hidden-navigation focus but creates this cross-area cost. Do not silently remove that rule to make B's keyboard numbers look smaller.

Use navigation landmarks, lists and ordinary links, with current-page text plus red rule/background. B adds `aria-current="true"` for the current area while retaining `aria-current="page"` for the actual destination; service pages do not falsely select the overlay area. No tablist, menubar, tree or roving-arrow contract is claimed. Actual screen-reader announcements, high contrast mode, zoom beyond these viewports and native window controls remain future verification work.

## Prototype and evidence locations

Source: [`navigationResearch/NavigationAlternatives.stories.tsx`](../../src/frontend/components/Settings/navigationResearch/NavigationAlternatives.stories.tsx), [`NavigationPrototype.tsx`](../../src/frontend/components/Settings/navigationResearch/NavigationPrototype.tsx), [`ResearchMenu.tsx`](../../src/frontend/components/Settings/navigationResearch/ResearchMenu.tsx). Only the stories import these research components. Shell/menu forks deliberately avoid modifying the production component's props or behavior. They reuse the actual logo asset, theme, route content, manifests, switch primitive and isolated in-memory bridge fixtures.

Run `npm run storybook -- --port 6013 --ci --no-open`. Open `http://localhost:6013/?path=/story/research-settings-navigation--top-app-links`, or replace the final story name with `grouped-links`, `area-split` or `baseline`. General states are `grouped-general`, `split-general`, `top-general`; LMU overlay states are `grouped-lmu`, `split-lmu`, `top-lmu`. Use the iframe URL for exact full viewport measurement: `/iframe.html?id=research-settings-navigation--top-app-links&viewMode=story`.

All review media and machine-specific audit scripts are **outside the worktree**, in `C:/Users/tarik/.t3/artifacts/settings-navigation-alternatives/`:

- `{baseline,grouped-links,area-split,top-app-links}-{808x656,1280x800,1920x1080}.png`: direct, exact-size viewport captures.
- `{grouped-general,split-general,top-general,grouped-lmu,split-lmu,top-lmu}-{size}.png`: app and simulator variants, same three sizes.
- `geometry.json` and `capture.cjs`: bounds, complete-row membership, focusable order, URL/state, browser version and PNG dimension assertions for 30 captures.
- `inventory.json`: serialized runtime menu/manifest/support inventory.
- `task-checks.json`, `task-checks.cjs`: explicit route, skip, search, toggle, support-reveal and focus checks.
- `keyboard-paths.json`, `keyboard-paths.cjs`: 20 recorded sequential-keyboard app paths, nine bottom-route paths and one current-area retention check.
- `top-skip-808x656.png`: visible first keyboard bypass.
- `comparison.html`: inline review board and compact list-height comparison.

The Storybook fixture is bounded to a fixed viewport for every pattern, including the production baseline; it does not resize or crop a larger image to masquerade as another viewport. Prototype data comes from fixture bridges, never installed profile files. No native app is launched. The prescribed preview rendered the components, but its measurement evaluation timed out twice; final measurements/captures use a fresh non-persistent Chrome context via the existing local Playwright installation. PNG headers are checked against each requested viewport. Browser rasterization and scaled inline viewing are not native typography certification; open the original PNG or live story to inspect exact pixels.

### Verification completed

Thirty direct viewport captures cover ten fixture states at the three requested sizes, with no page errors. Eighty-seven scripted checks pass across the viewport matrix: all five app destinations, first skip link, route focus, overlay search/toggle behavior, query retention, no-results, service-link visibility, route reveal and LMU support reveal. Thirty additional recorded paths confirm the keyboard sequences above, all three bottom routes for each alternative, and current-area retention in B. These are deterministic checks, not user-study outcomes.

TypeScript and scoped ESLint pass. The existing settings-menu/toggle tests pass (14 tests), as does the widget registry spec (7 tests); `git diff --check` passes. The standalone comparison board also passes 18 image/state combinations. The production shell, production menu, registry, logo, theme, route content, Widget Scale and startup sizing files are unchanged. Native window controls, dragging, zoom, localization, assistive-technology announcements and live simulator behavior are outside this prototype verification.

## First-round implementation outline (superseded)

1. Keep `generalItems`, `bottomItems`, widget manifests and every URL unchanged. Extract a shared presentational route link from the current menu so App and sidebar links retain identical active and focus treatments. Promote C's band into the production shell below the existing header and storage notice, outside the drag region; remove only the App disclosure from `SettingsMenu`.
2. Keep search, query state, compatibility reveal and the overlay scroller separate from the App row. Preserve current resize/active-route reveal behavior. Keep grouped broadcast behavior and primary/extra-instance enable semantics exactly: off disables every copy, on revives the primary only, and aggregate On reflects all copies.
3. Retain the first skip link, `main` ref and pathname-only focus effect. Never move focus merely because filtering or simulator support changes. Preserve current-page semantics and persistent service access; retain Release notes unread state.
4. Use existing settings tokens and Tailwind. Keep actual logo artwork, RED identity, settings-owned Segoe UI type roles, 232/252px sidebar and bounded form width. Allow the App row to wrap without hidden overflow. Add a scoped no-drag region if necessary when integrating into native chrome; verify the existing OS button clearance and header drag area in an isolated native profile.
5. Before publication, test all five App links and three services from both domains, focused skip and return behavior, query/scroll retention, missing-primary widgets, grouped widgets, extra instances, no-results and unsupported widgets. Run existing menu/registry checks plus type/lint. Review compact/preferred/wide, 200% and 400% zoom, longer labels, keyboard and screen readers. No persistent schema, IPC, profile resolution, telemetry, Widget Scale or startup-sizing work is required.
6. Once a pattern is chosen, either remove these research-only shell/menu forks or retain a deliberate archive story; do not allow copied implementations to become a second production navigation system.

## First-round decision criteria (historical)

Observe people finding Profiles, changing a key binding, assigning Driver Tags, opening Setup Comparison, finding/toggling a named overlay and returning to the prior overlay, from both app and overlay starting states. Record first chosen destination, unexpected detours, requests for help, successful route arrival and keyboard recovery separately; do not infer them from click counts.

Favor A if people repeatedly overlook the top row, naturally scan the sidebar for every destination, and still browse/toggle overlays comfortably with three compact rows. Favor B if they reliably predict which area contains each task and the separation reduces wrong turns enough to justify an extra area change and hidden overlay controls. Reassess C if new app pages, localization, zoom or frequent short-window work make its 49px cost grow materially, or if observers confuse its App links with page-specific tabs. Fit measurements suggest C is the best starting candidate; user task evidence should decide adoption.

## Hierarchy follow-up after user feedback

The user found C confusing because its overlay sidebar is irrelevant to the app-level page beside it. This is evidence against the proposed information architecture, not a disagreement about available pixels. The earlier comparison gave too much weight to exposing every destination continuously. The revised criterion is: **the local navigation must describe the content currently being configured**.

### Additional primary research

Checked 6 November 2026. These sources provide design guidance; none is a study of irDashies users.

| Exact source / section                                                                                                                                                                                                                                                                                                                                                                        | Source guidance                                                                                                                                                                                                                                                                                                                      | Our application and limits                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Windows navigation design basics](https://learn.microsoft.com/en-us/windows/apps/design/basics/navigation-basics), **Use the right structure → Combining structures**, **General recommendations**                                                                                                                                                                                           | Hybrid structures are supported. Secondary peer navigation should stay within its own branch. Relationships and routes need to be clear; excessive drilling up and down has a cost.                                                                                                                                                  | The widget catalog belongs beside widget configuration. General and Profiles need an app-level navigation context. This supports replacing the sidebar when areas change; it does not dictate the number, labels or placement of our areas.                                                                                           |
| [Windows guidelines for app settings](https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings), **When to provide a settings page**, **Entry point → Navigation pane / Command bar**, **Layout** (page updated 15 April 2026)                                                                                                                          | Distinguishes app preferences/information from common workflow commands. Recommends a dedicated settings page; for a navigation-pane layout, a settings entry pinned at the bottom. A direct command-bar entry is an option when discovery matters. Settings should occupy the window's work area and retain readable content width. | E uses a pinned, labeled entry that opens a separate app settings view in the existing window. It has no dropdown or modal. Overlay configuration remains the primary task area. We keep the current 960px content bound and existing forms; no toolkit migration, maximize action or startup-size change follows from this guidance. |
| [Carbon global header](https://www.carbondesignsystem.com/building-blocks/core/patterns/global-header), **Header and panel persistence**, **Navigation → Local**, **Persistent data and UI state**, **Sense of place** (page updated 11 August 2026); [left panel](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/guidelines), **Anatomy / Behavior** | Distinguishes persistent global access from context-specific local navigation. Groups related pages into task areas, uses the header to communicate context, and recommends retaining state across area changes. The left panel provides secondary navigation.                                                                       | D keeps two global area links and changes the local sidebar. E keeps a global settings entry while changing the full work area and providing a clear return. Both identify the area in the header and accessible landmarks. State restoration is an explicit check, not an assumed benefit.                                           |
| [Apple Settings HIG](https://developer.apple.com/design/human-interface-guidelines/settings), **Platform considerations → macOS**                                                                                                                                                                                                                                                             | macOS uses a dedicated settings window with stable pane navigation and a remembered pane; it discourages toolbar settings buttons there.                                                                                                                                                                                             | This reinforces separating settings from task content, but its App menu, window and toolbar conventions are platform-specific. It is not evidence that this Windows/Electron app should open another native window.                                                                                                                   |

The sources do not say that fewer clicks outweigh a wrong hierarchy. They also do not imply that all five current app routes are infrequent preferences: Profiles, Driver Tags and Setup Comparison include management tasks. Keeping them together is a provisional organization based on the current registry and the user's distinction between app-wide and individual-overlay work. Their existing data ownership remains unchanged.

### D — Top-level areas with contextual navigation

An always-visible **Overlays / App settings** row selects the area. In Overlays, the sidebar contains overlay search, the catalog and switches. In App settings, that sidebar is replaced with General, Profiles, Key Bindings, Driver Tags, Setup Comparison and the three service routes. The header context and selected area agree with the sidebar and main content.

This extends B structurally: the area selector is above the whole work area, rather than looking like a filter within an overlay sidebar; service routes also follow the app context. Unlike C, no widget catalog remains beside General or Profiles. The two areas are equally prominent. This is a useful alternative if people frequently alternate between them, but that frequency is not established. The extra row costs 49px of page height.

### E — Dedicated App settings workspace (revised recommendation)

While configuring overlays, a **44px-high App settings link**, with gear icon and visible text, is pinned beneath the catalog. Activating it immediately opens General on first use. The entire work area now uses an app-only sidebar and the header says App settings. The widget catalog, overlay search and overlay switches are absent from this navigation context. **Back to overlays** returns to the previous overlay page. A later App settings visit restores the last app page for the current session.

This is a destination, not a disclosure of five hidden links: the first activation changes the view and exposes stable app navigation. Profiles and the other pages are then ordinary sidebar destinations. It directly addresses the reported false relationship between the overlay catalog and app-level settings, without making app settings another permanent primary row. It also avoids introducing a separate native window, modal focus trap or new IPC/window lifecycle.

Advanced, Release notes and About are pinned at the bottom of the app sidebar in both D and E. From an overlay they now need App settings → destination (two activations, previously one). They have not been removed. This intentional navigation tradeoff needs user review, particularly for frequent Advanced users. The existing release-notes badge logic remains attached to that route.

### Task paths and visibility

Start on Relative, with no previous app-area visit. D and E both take one activation to open General, two to reach each of Profiles, Key Bindings, Driver Tags and Setup Comparison, and two to reach each service page. Once inside App settings, every app/service page is one activation away. Returning to the previously selected overlay is one activation. The prototype's area selection is derived from the URL, so a direct Profiles or Advanced URL opens the correct sidebar immediately.

In an app view, both D and E expose all five app destinations plus the three service destinations and **zero overlay search/toggle controls**. In an overlay view, D exposes the two area links and E exposes the pinned App settings entry; neither mixes individual app-page links into the catalog. The widget registry, URL paths, grouped Broadcast behavior and simulator support lists are unchanged.

General's Overlay appearance section still configures shared overlay preferences. A matching app sidebar does not imply those preferences change scope, profile ownership or save behavior.

### Measured fit

Same isolated fixtures and type roles as round one, all at device scale factor 1. Complete rows use the actual initial Relative reveal position. The form widths remain 544px compact and 960px at the other sizes; sidebars remain 232/252px.

| Viewport    | D main height | E main height | D overlay list px / full rows | E overlay list px / full rows |
| ----------- | ------------- | ------------- | ----------------------------- | ----------------------------- |
| 808 × 656   | 527           | 576           | 416 / 11                      | 400 / 10                      |
| 1280 × 800  | 671           | 720           | 560 / 14                      | 544 / 14                      |
| 1920 × 1080 | 951           | 1000          | 840 / 22                      | 824 / 21                      |

The overlay-list gain comes mainly from moving the three service rows into the app area. It is not a universal space improvement: E has zero visible overlay rows while in App settings, which is intentional contextual separation. LMU retains 15 supported catalog entries; complete rows for D and E are respectively 11/10 compact, 13/13 preferred and 15/15 wide. Both reveal the same 15 unsupported entries, retain the reveal state across an area change, and offer no switch for unsupported widgets.

All five app-page links remain at least 36px high. E's pinned entry is 44px high and 207px wide compact / 227px at larger widths. D's area links are 40px high. These are rendered target bounds, not participant discoverability measurements.

### Keyboard, recovery and current limitations

Skip to settings remains the first focusable control: Tab, Enter focuses main in either area. Route changes focus main; clicking an already-current route does not force that transition. Hidden overlay controls leave the sequential focus order and accessible navigation context. D has 65 preceding stops in its iRacing overlay view and 13 in the app view; E has 65 and 12 respectively. These include skip links, header actions and offscreen catalog controls. LMU overlay views have 37 stops in both candidates.

D reaches App settings from fresh document focus with five Tabs and Enter. E adds a second **focus-only Go to App settings link** immediately after the existing skip link, so two Tabs and Enter enter the app view without traversing the long catalog. The pinned visible entry remains keyboard reachable too; sequentially reaching it without using the bypass is still expensive. This second bypass is a design inference and prototype behavior, not a new saved/global key binding. On an app view, Back to overlays is E's first sidebar destination after the header actions. Area navigation uses normal links; no ARIA tablist keyboard contract is implied.

Round-trip checks restore the prior overlay route, search query, changed enabled state, simulator support reveal and last app route. **Manual scroll position is not fully restored**: an intentional scrollTop of 120px returned to 380px in D and 396px in E at compact size because the inherited active-route reveal runs again. This limitation is recorded separately from the passing route/query checks. An implementation should preserve manual catalog scroll on area return while still revealing a newly selected route. Do not claim complete context restoration until that distinction is implemented and verified.

The same-window route change remounts page forms, as current navigation already does. This research does not claim to preserve arbitrary unsaved drafts or editor-local tab state. Verify those cases before adopting area navigation. Native chrome, assistive-technology announcements, zoom and long labels remain separate checks.

### Prototype evidence and adoption outline

New stories in the existing research-only files: `contextual-overlays`, `contextual-general`, `contextual-profiles`, `contextual-lmu`, `dedicated-overlays`, `dedicated-general`, `dedicated-profiles`, `dedicated-lmu`. For example: `http://localhost:6013/?path=/story/research-settings-navigation--dedicated-overlays`. No production navigation component imports these variants.

Review artifacts live outside the worktree at `C:/Users/tarik/.t3/artifacts/settings-navigation-alternatives/hierarchy-follow-up/`. `geometry.json` records 24 state/viewport captures. Compact and preferred PNGs come from the shared preview. It produced downsampled 1280 × 720 PNGs for 1920 × 1080 viewports; those are explicitly named `preview-...-1280x720-from-1920x1080.png`. Exact wide PNGs were exported from a fresh non-persistent Chrome context, with PNG header dimensions and main/list geometry verified against the shared preview. `checks.cjs` / `checks.json` record 78 passing task records and the two manual-scroll observations. These are deterministic checks, not study results. `hierarchy-comparison.html` shows the new candidates and their entry/app states.

If E is chosen, implement a route-derived app/overlay shell context, the pinned settings destination, matching app navigation, explicit overlay return and keyboard bypass. Keep existing URLs, header action callbacks, current profile resolution, widget-instance toggling, compatibility filtering, actual artwork, RED identity, type roles and every persistence/IPC contract. Restore local query/support/scroll state without persisting new navigation settings. Keep page forms and overlay content unchanged. No native window, startup sizing or Widget Scale work is required.

Prefer D instead if users repeatedly overlook the pinned entry or spend enough time switching areas to benefit from a persistent top-level selector. Reconsider both if people place Profiles, Driver Tags or Setup Comparison differently in task-based sorting, or if moving Advanced behind an area change causes repeated detours. The next useful evidence is whether someone can explain what the sidebar applies to, find a requested app page and return to their overlay without losing context. Pixel counts alone cannot decide this.

### Profiles as a shared destination (earlier sidebar proposal)

User feedback accepts E's separation while placing Profiles in the overlay workflow. The refinement provides a persistent Profiles link above the overlay catalog, with `Current: <profile name>` as its visible and accessible description. The destination is taken from the existing menu registry. It opens the existing `/settings/profiles` management page directly, with the app sidebar and Back to overlays path. It does not introduce a second profile manager or a profile-switching dropdown. The current profile text is read from the existing dashboard context.

The link is 56px high with the Default fixture; its 12px bottom gap costs 68px of overlay-list height. The iRacing list is 332px / 8 full rows at 808 × 656, 476px / 12 rows at 1280 × 800 and 756px / 19 rows at 1920 × 1080. Main height and width are unchanged. A long profile name wraps and can increase the link's height. The first skip remains first; from fresh document focus, five Tabs and Enter open Profiles. Search, enable switches and App settings remain available, and Back to overlays retains the existing route/query behavior. The inherited manual-scroll limitation above remains.

Stories: `dedicated-profile-shortcut`, `dedicated-profile-shortcut-page` and `dedicated-profile-shortcut-lmu`. All use isolated fixtures. Review media and audit files are outside the worktree in `C:/Users/tarik/.t3/artifacts/settings-navigation-alternatives/profile-access/`. The earlier E stories remain available for comparison. Production navigation and all profile/storage/IPC semantics are unchanged.

### Current profile control under the logo

The user's preferred location replaces the passive Default Profile caption with a 28px-high disclosure button using the existing small type role and a Phosphor chevron. The panel contains profile choices with a check on the current value and a Manage profiles… link. Native buttons and Tab order are retained; Escape closes the panel and restores the trigger. Outside clicks and leaving the control dismiss it. Selection uses the existing `switchProfile` context action, closes and returns focus. Management keeps the existing Profiles route and main-focus behavior. The control is explicitly outside the native drag region.

The extra sidebar shortcut is absent. The existing `dedicated-profile-shortcut` story URLs now show this preferred placement, with `dedicated-header-profile` aliases. Two synthetic profiles share the navigation dashboard so switching can be exercised entirely in fixture memory. Exact-size open-panel captures and switching/keyboard checks for all three requested sizes are outside the worktree at `C:/Users/tarik/.t3/artifacts/settings-navigation-alternatives/header-profile/`. This was the final E prototype selected for implementation. The shipping change promotes its navigation and header picker while leaving profile bridge/storage code unchanged.

## Implementation handoff

The selected E pattern is implemented in `SettingsLayout`, `SettingsMenu` and `HeaderProfilePicker`; the research variants remain isolated Storybook comparisons. The production picker uses the existing dashboard-context switch action. A rejected switch retains the picker, announces an error and permits retry; pending requests reject duplicate activation. Direct App routes use App navigation, including the initial General redirect. The header Manage action focuses main even when Profiles is already selected.

Production preserves manual overlay scroll separately from active-route reveal. At the preferred viewport, a manually scrolled 124px list returned at 124px after an App round trip, with main focused. This resolves the prototype limitation recorded above; the historical prototype observations remain unchanged. The first skip link still reaches main, followed by a focus-only App shortcut in overlay context. Review captures, browser checks and build logs remain outside the worktree in the `shipping/` artifact directory.

The `baseline` story follows current production; the original disclosure baseline is frozen in the external captures. The temporary before/after capture fixtures are also retained outside the worktree, rather than adding a second archived production shell to the repository.
