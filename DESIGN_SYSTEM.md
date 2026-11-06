# irDashies settings design system

Iteration 03 and UX pass - 5 November 2026. Parent aesthetic review: 9/10 in all seven categories for the reviewed settings UI. Research-backed task checks: 6/10 before UX fixes, 10/10 afterwards. Iteration 01 and 02 parent reviews and scores are preserved below.

## Purpose and principles

Settings is a calm control station for preparing a racing overlay. Make the current task obvious, keep controls close to their labels, and preserve the useful density of a desktop utility. Use precision in proportions and the existing red irDashies identity. Avoid racing textures, promotional imagery, ornamental statistics and empty preview panels.

This document is continuously maintained with each implementation iteration. The parent reviewer owns the aesthetic scores. Implementation evidence and accessibility measurements are not aesthetic scores or a usability study.

## Scope and compatibility

The `.settings-shell` root owns its font, type scale and neutral/accent tokens in `src/frontend/theme.css`. Local token aliases let existing settings pages participate without fragile descendant class overrides. The only shared descendant rule is keyboard `:focus-visible` for native interactive elements.

Do not change global overlay typography, telemetry colours or user preferences to style settings. Overlay themes remain independently configurable. No persistence shape, profile resolution, keyboard binding, IPC bridge, telemetry subscription or calculation changes belong to this redesign. The existing native-titlebar drag region, no-drag actions and `titlebar-area-*` clearance formula are retained. Storybook cannot certify native window-control clearance; native verification remains a separate review concern.

## Palette and real tokens

Neutral/accent aliases are scoped to `.settings-shell`. Settings-prefixed semantic roles are registered in Tailwind @theme for opt-in utilities and are only consumed by settings controls; they do not remap overlay tokens. Opaque surfaces remain the foundation. Alpha is used only for selected backgrounds and light panel differentiation.

| Semantic role                            | Existing utility token      | Value     |
| ---------------------------------------- | --------------------------- | --------- |
| Shell/navigation canvas                  | `--color-slate-950`         | `#141a21` |
| Page surface / field contrast            | `--color-slate-900`         | `#1b222b` |
| Raised control/panel                     | `--color-slate-800`         | `#242c36` |
| Quiet grouping rule / off switch track   | `--color-slate-700`         | `#343d49` |
| Legacy neutral stop (not a control fill) | `--color-slate-600`         | `#768394` |
| Neutral filled control                   | `--color-settings-control`  | `#242c36` |
| Neutral hover fill                       | `--color-settings-hover`    | `#343d49` |
| Interactive boundary                     | `--color-settings-boundary` | `#8794a6` |
| Legacy range track                       | `--color-settings-track`    | `#8794a6` |
| Secondary legacy copy                    | `--color-slate-500`         | `#9aa5b4` |
| Helper/navigation copy                   | `--color-slate-400`         | `#a5afbd` |
| Secondary labels                         | `--color-slate-300`         | `#c5cdd7` |
| Main text                                | `--color-slate-200`         | `#e0e5eb` |
| Selection/focus/slider signal            | `--color-accent-400`        | `#f87171` |
| Selected label                           | `--color-accent-200`        | `#fecaca` |
| Filled action / on switch track          | `--color-accent-500`        | `#dc2626` |
| Filled action hover                      | `--color-accent-600`        | `#b91c1c` |
| Text on filled action                    | `--color-on-accent`         | `#ffffff` |

Remaining slate stops: 50 `#f6f7f9`, 100 `#edf0f4`. Remaining accent stops: 100 `#fee2e2`, 300 `#fca5a5`, 700 `#991b1b`, 900 `#450a0a`. Semantic warning amber, destructive red, and existing telemetry-specific colours retain their meanings. Selection also has a left rule, tab underline or changed position: colour is not its sole cue.

Rendered iteration 02 contrast samples (WCAG sRGB relative luminance, including ancestor alpha compositing; not a complete accessibility certification):

| Pair/state                                      | Ratio   |
| ----------------------------------------------- | ------- |
| Neutral control text / default                  | 11.14:1 |
| Neutral control text / hover                    | 8.68:1  |
| Neutral boundary / default interior             | 4.58:1  |
| Neutral boundary / hover or outer group         | 3.57:1  |
| Selected Icon text / composited group           | 6.66:1  |
| Selected Icon boundary / interior               | 3.48:1  |
| Name selection text / composited panel          | 9.07:1  |
| Name selection boundary / interior              | 4.74:1  |
| Name selection keyboard focus / panel           | 5.50:1  |
| White / primary red normal                      | 4.83:1  |
| White / primary red hover                       | 6.47:1  |
| Destructive confirmation text / composited tint | 10.77:1 |

The full measured CSS colours, effective foreground/background and unrounded ratios are in `artifacts/settings-design/iteration-02/browser-evidence.json`. The old iteration 01 solid-token table did not cover legacy fill usage; it is superseded by rendered state evidence.

Quiet grouping rules are decorative, not interactive boundaries. The semantic settings-boundary stroke identifies controls independently of neutral fill roles. Actual translucent pairs and existing specialised visualisations still need case-by-case review.

## Type roles and font availability

Settings uses `'Segoe UI', system-ui, sans-serif`, 14px / 1.5, normal weight. Segoe UI comes from the Windows installation; no new remote font request or redistributed Microsoft font file is introduced. Microsoft owns the font and supplies licensing/redistribution terms; this project does not relicense it. On other platforms the local system UI font is the fallback. The existing Lato/Google Fonts path and overlay font preferences are unchanged.

| Role                   | Size        | Treatment                                        |
| ---------------------- | ----------- | ------------------------------------------------ |
| Brand                  | 24px        | Bold, tight tracking, actual irDashies logo      |
| Window context/profile | 13px / 12px | Secondary, subordinate to page task              |
| Page heading           | 24px        | Semibold, tight tracking                         |
| Section heading        | 17px        | Semibold                                         |
| Control label/body     | 14px        | Normal or medium                                 |
| Helper/control/nav     | 13px        | Normal, 1.5 line height                          |
| Group caption/key hint | 12px        | Group captions use restrained uppercase tracking |

The scoped `--text-xs/sm/md/base/lg/xl/2xl` tokens are 12/13/14/14/17/24/26px. Numeric values use tabular numerals where useful. Storybook explicitly wraps settings in an Extra Small overlay ancestor and supplies Lato/Normal/Extra Small fixture preferences to expose inheritance regressions. These are the observed user's settings, not claimed factory defaults.

## Spacing, widths and recomposition

Use a 4px rhythm: 8px related gaps, 12px compact gutters, 16px section padding, 20px row/section separation, 24px between major groups. Most controls are at least 36px high. Small navigation switches are 36 × 24px inside 36px rows; standard switches are 44 × 24px.

The sidebar is 232px below the 1280px Tailwind `xl` breakpoint and 252px above it. Labels wrap instead of truncating. The main page flexes with `min-width: 0`; its inner form column is bounded at 960px and centred in the remaining area. Main gutters are 16px, increasing to 28px at 1024px (`lg`). Extra wide windows retain deliberate quiet margins instead of separating labels and controls by metres of empty row space.

The persistent header is at least 80px and can wrap its actions if needed. Native control clearance uses environment values, not a guessed button width. Navigation and page content have independent vertical scroll areas. Navigation service links remain at the bottom. Workspace access stays outside the scrolling overlay list. Route reveal is limited to that scroller; ordinary rerenders preserve manual scroll. Search stays outside the scroller too. Page tabs wrap at compact widths, preserving every action without horizontal scrolling. Select/number/button rows wrap when necessary. Fuel's existing editor and widget pool stack below 1024px, and sit side by side above it. Supported evidence sizes are 808 × 656, 1280 × 800, 1920 × 1080 and 2560 × 1440; this iteration does not claim a phone layout.

## Settings window geometry and one-time transition

The preferred native Settings **outer window** is 1280 × 800 logical pixels
(Electron DIP). For the PRIMARY monitor's usable `workArea`, independently set
`width = min(1280, floor(workArea.width × 0.9))` and
`height = min(800, floor(workArea.height × 0.9))`. Centre it with
`x = round(workArea.x + (workArea.width - width) / 2)` and the equivalent `y`
formula. Include taskbar/dock offsets and negative origins. Do not multiply by
`scaleFactor` or use full/physical display bounds. The cap applies to defaults;
users may resize and move the window and later restore their saved rectangle.

This separately authorized bounds transition discards every pre-update saved
Settings size **and** position once, including custom old rectangles. A dedicated
`settings-window-bounds.json` in application user data atomically stores
`defaultSizeApplied: true` alongside any later user bounds. The legacy
`config.json.settingsWindowBounds` key is ignored; shared config, dashboards,
profiles and overlays are untouched. Initialization is asynchronous and awaited
before Settings can open. Future window construction reads only the cache;
existing off-screen rescue, start-minimized, window reuse and native titlebar
options remain in place.

There is no app-imposed minimum that could exceed a small screen. The only
integer floor is one logical pixel when 90% rounds to zero. Extremely small
logical work areas cannot accommodate the desktop form and native controls;
the OS may enforce a larger native frame. This sizing change does not claim a
new compact UI layout. It preserves the actual irDashies logo and red identity.

## Shell and information hierarchy

1. Window header: irDashies identity, settings context, active profile, existing Demo and Edit Layout actions.
2. Navigation: persistent Workspace disclosure, searchable alphabetical Overlays, then service links. Do not invent a permanent widget taxonomy yet; search preserves established names/order and simulator support filtering.
3. Page header: one task title, concise description, existing enable state where appropriate.
4. Page tabs: retain established specialised settings areas; selected label, background and underline make the active area clear.
5. Sections: quiet bordered surfaces with meaningful headings. General now groups overlay appearance, edit mode and application/connectivity. Sortable Display Order items use simple separators within their section instead of nested cards.

## Forms and states

- Use existing `Setting*Row`, `SettingsSection`, `BaseSettingsSection`, `TabButton` and `ToggleSwitch` primitives. Preserve manifest-backed settings and existing save callbacks.
- Fields: opaque dark surface, 1px interactive border, readable value, 36px minimum height in shared rows. New accessible labels tie the visible purpose to switches and number inputs.
- Sliders: native range input, red brand signal, explicit value and units when supplied. Keep native keyboard behaviour.
- Buttons: neutral raised surfaces for secondary actions; brand red and white for primary create actions. Destructive actions use explicit labels/icons and an outlined tint; warnings use amber text/tint rather than low-contrast white on yellow. Filled button colours meet text contrast targets.
- Hover: brighten the boundary or raise the neutral surface. Selected: light red rule/underline plus text/background; name formats include a check mark and aria-pressed. `aria-current` identifies the page; tab-like buttons retain native button semantics with `aria-pressed` rather than claiming a tablist implementation without its keyboard pattern.
- Focus: 2px light red `:focus-visible` outline, 3px offset, scoped to settings. Switches retain their focus ring.
- Disabled: native `disabled` plus existing explanations, reduced emphasis, no invented value changes. Simulator support messages remain intact. Error/warning copy keeps its existing meaning and uses text alongside semantic colour.
- Search: local UI state only; case-insensitive, trimmed name match; workspace/service routes stay available; no-match status; native clear behaviour. It never persists or changes enabled widgets.

## Preview policy

Only show previews backed by real component/configuration architecture. Retain Fuel's real layout editor; it is a structure editor, not a live fuel telemetry preview. No fake Relative/Standings screenshot, decorative adjacent panel or new telemetry plumbing is added in iteration 01. Existing specialised previews remain available. A future adjacent live preview requires a separate architecture-aware decision and evidence at compact widths.

## Accessibility targets and evidence limits

Target normal text ≥4.5:1 and applicable interactive boundaries/state cues ≥3:1. Preserve semantic native inputs, labels, keyboard activation, visible focus, and multi-cue selected states. Aim for ≥24px targets, ideally 36px for desktop controls. Do not infer full WCAG conformance from selected token ratios. Review zoom, long content, keyboard order, native titlebar clearance and drag-only legacy editors separately. The existing Fuel drag editor has no new keyboard rearrangement model in this iteration. Iteration 01: the preview tool saved the valid 1920 × 1080 viewport capture as a downsampled 1280 × 720 PNG. The attempted 2560 × 1440 image was incomplete and discarded; its independently measured DOM dimensions remain in the manifest as viewport checks only. The manifest records both CSS viewport and actual PNG dimensions. Iteration 02 now supplies native full-resolution captures and direct original-resolution browser PNGs; use those and the running stories for typography review.

## Research findings → implementation decisions

- [Carbon left panel guidance](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/guidelines): a left panel supports frequent switching among many secondary items; deeper content belongs in page tabs. Retain a predictable sidebar and existing tabs. The exact 232/252px widths are our design choice, not Carbon's prescription.
- [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): specialised settings can live behind secondary choices. Keep existing widget tabs and grouped General sections; do not collapse unfamiliar options behind new invisible defaults. Search is a deliberate discovery choice, not a claimed research requirement.
- [Material applying type](https://m3.material.io/styles/typography/applying-type) and [type scale](https://m3.material.io/styles/typography/type-scale-tokens): these supplied pages required JavaScript and did not expose their guidance in the retrieved source. No precise Material recommendation is claimed; the role sizes above are deliberate irDashies choices informed by the baseline legibility issue.
- [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast): use numerical text and component thresholds, not screenshot impression. This drives brighter helpers/borders and a red action fill that supports white normal-size text. The earlier amber branding assumption was superseded by user correction; contrast guidance did not justify that branding choice.
- [Microsoft Segoe UI](https://learn.microsoft.com/en-us/typography/font-list/segoe-ui): confirms the screen-oriented family, Windows availability and proprietary redistribution terms. Use the installed system font; do not bundle it or fetch another interface font.

## Deliberate choices and changed assumptions

The iteration 01 substitute flag and amber branding were implementation assumptions, superseded by the user correction in iteration 02. They were not research-backed irDashies identity. Current settings uses the existing logo and red brand, restrained section captions and bounded form proportions. Research does not establish that these colours improve driving or task performance. Retaining an alphabetical catalogue with search is a conservative first step before inventing category membership.

The old settings shell inherited overlay fonts/sizing/colours. It now owns UI tokens, because the observed Extra Small preference must not make configuration text tiny. The observed setting is not treated as a factory default. Wide windows now bound content rather than stretching every row. Fuel's heading identifies the task; its specific instance remains visible in the existing editor selector.

## Rubric and review status

Use the original category definitions, anchors and weights from `C:/Users/tarik/projects/irdashies-design-baseline/rubric.json`. Baseline is the parent's installed 2.1.0 settings assessment, not a score assigned by this implementation agent.

| Category                      | Definition/question                                                             | Weight | Baseline | Iteration 01 parent review |
| ----------------------------- | ------------------------------------------------------------------------------- | ------ | -------- | -------------------------- |
| Visual hierarchy              | Does visual emphasis reflect the importance of the information?                 | 20%    | 6        | 8                          |
| Typography and numerals       | Are text and data visually clear, balanced, and consistently styled?            | 20%    | 6        | 8                          |
| Spacing and composition       | Do alignment, grouping, rhythm, and density make the composition feel ordered?  | 15%    | 5        | 8                          |
| Colour and contrast           | Is the palette harmonious, with clear differentiation and appropriate emphasis? | 15%    | 7        | 7                          |
| Consistency and finish        | Do repeated visual treatments form a coherent family?                           | 10%    | 8        | 7                          |
| Visual restraint              | How much visual competition comes from decoration and nonessential emphasis?    | 10%    | 8        | 8                          |
| Distinctiveness and character | Does the visual language feel intentional and appropriate for a racing product? | 10%    | 5        | 7                          |
| Weighted total                | Sum(score × weight), rounded to one decimal                                     | 100%   | 6.3      | 7.7                        |

## Iteration changelog

### 01 — bounded settings control station

Implemented shell/sidebar widths, settings-owned typography/palette, search/current-route semantics, General grouping, shared forms/panels/selected/focus treatments, wrapping page tabs and compact Fuel editor recomposition. Aligned Profiles, Key Bindings, Driver Tags and Advanced page headings. Fuel label/value font sliders now stack at compact widths, use bounded grids and have accessible names; the old fixed margin and intrinsic input width caused overflow at 808px. Added Fuel, empty Fuel, Profiles and Keybindings shell stories. Kept profile/storage/telemetry logic and app bridges unchanged. Actual Storybook screenshots, routes, viewport measurements, contrast pairs, checks and limitations are maintained in `artifacts/settings-design/iteration-01/evidence-manifest.json`. Parent review was pending at implementation handoff; the independent review below now supplies its scores. No category was self-awarded by the implementation agent.

### 01 — independent parent review

The parent reviewed the supplied rendered screenshots, current Relative story and selected name-format state, theme tokens and representative legacy controls. This is a heuristic assessment under the unchanged rubric, not a controlled study. Scores above are the parent's, not the implementation agent's. The result is **7.7/10**, with no category yet reaching the requested 9/10 gate.

The bounded layout and settings-specific type scale materially improve hierarchy, legibility and composition. The charcoal/amber direction is promising but still resembles a general settings utility. The following prevent a 9:

- **Hierarchy / composition:** scrolling to an active overlay hides Workspace routes; returning to General or Profiles requires scrolling back. Keep a stable visible route back without sacrificing most of the overlay list at compact heights. Complex children still form long, similarly weighted rows.
- **Typography:** readable base roles are in place; labels, children and small legacy actions still need a consistent hierarchy and representative state review.
- **Colour:** redefining slate-600 as `#768394` fixes borders but brightens existing solid buttons and hover fills. `#c5cdd7` on that fill is **2.40:1**, white is **3.86:1**, and `#e0e5eb` is **3.04:1**. Examples remain in DriverTagsSettings, PitLaneCalibrationSettings, AdvancedSettings, BroadcastSettings and CarSetupSettings. Disabled controls are not the finding. Separate semantic boundary tokens from enabled button surfaces, then verify actual rendered default/hover/selected states. The legacy selected DriverNamePreview border uses dark amber `#986016`; against raised `#242c36` it is **2.70:1**. Review that state and its accessible selection indication too.
- **Consistency / restraint:** universal bordered SettingsSection wrappers also affect nested/titleless sections, creating avoidable panel nesting on Header/Footer pages. Fuel's structural editor and legacy complex controls are less finished than the main forms. Review actual complex pages with complete isolated mock bridges; Driver Tags remained at Loading in the parent's shell story, so its rendered states were not certified.
- **Identity:** refine the existing restrained direction through coherent typography, proportions, navigation and a deliberate brand treatment; adding ornament or a larger banner will not itself earn a higher score.

Native Electron titlebar/drag/control clearance and high-quality full-size wide screenshot evidence remain outstanding. Keep testing compact, medium and wide layouts, long labels and active/focus/disabled/error states. The parent's evidence and exact feedback are in `artifacts/settings-design/iteration-01/parent-review.json`. Preserve this review when appending iteration 02 decisions and evidence.

## Brand identity — user correction in iteration 02

The user explicitly corrected the amber/orange assumption and invented flag: irDashies already has a logo and a red brand. The settings header now imports `src/frontend/assets/icons/logo.svg` unchanged. The same artwork exists at `docs/assets/icons/logo.svg` / `logo.png` and `site/public/logo.svg`. Its red, orange and blue artwork colours are preserved; no tint, replacement symbol or invented logo is applied.

Existing `site/src/sections/Hero.tsx` uses the real `/logo.svg`, a white “ir” / red-600 “Dashies” wordmark, and red-600/red-700 actions. Settings follows that identity while retaining opaque charcoal form surfaces. The logo itself is the identity mark. `site/src/theme.css` supplies site context; its decorative textures/stripes are not imported into settings. The UI still uses installed Segoe UI and offline system fallback.

Brand actions use #dc2626 with white text and #b91c1c hover; selection/focus use lighter #f87171 and #fecaca text over a subtle red tint. This avoids using bright red solids everywhere. Destructive confirmation uses an outlined red-tinted treatment, an explicit destructive verb and trash icon; errors remain labelled messages. Amber is reserved for meaningful warnings/status and existing telemetry semantics. Historical iteration 01 amber is a superseded assumption, not research-backed branding.

## Iteration 02 decisions and research

- **Contrast discovery:** the iteration 01 solid-token table was insufficient: repurposed slate-600 also appeared as enabled legacy fills. Parent measurements were 2.40:1 for slate-300, 3.86:1 for white and 3.04:1 for slate-200 on #768394. Settings `bg-slate-600`, `hover:bg-slate-600` and `hover:bg-slate-500` usages now use explicit dark fill roles. Borders use `settings-boundary`. The reusable `settings-button` utility supplies 36px sizing, normal-weight 13px action text, border, fill and hover states. Selected controls have a separate pressed variant.
- **Boundary refinement:** rendered Driver Tags Cancel on a #343d49 group showed the previous #768394 border at only 2.85:1 against its outer neighbour. The semantic border #8794a6 is brighter to handle both raised and hover surfaces. This did not darken borders to mask the fill bug.
- **Navigation alternatives:** five fixed Workspace rows consumed about 180px before their heading. A select would be compact but model route navigation as value selection and conceal ordinary link affordances. We chose a compact persistent disclosure containing normal links, following the [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) (Enter/Space button, aria-expanded/aria-controls). The [combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) describes choosing input values, a weaker fit here. The comparison and choice are ours, not a research mandate. Escape dismisses and returns focus, outside clicks dismiss, and route selection closes it. The overlay scroller remains separate, preserving search and support filtering.
- **Grouping:** `SettingsSection` supports explicit `panel` and `inline` variants. Titleless groups default inline. Relative/Standings Header, Footer and nested title-bar controls share one outer panel with a light inset rule. Session rows have a 36px rhythm, normal labels and smaller indented secondary controls.
- **Name formats:** the original fixture omitted nameFormat, matching the manifest default. Production DriverNameCell and TeamNameCell already fall back to name-middlename-surname. This was a settings presentation omission, not a renderer name-format bug. Settings now displays that default without writing it to storage; an explicit click saves the choice. Each option has aria-pressed, a bright selection border and a check mark.
- **Complex coverage:** shell stories supply isolated Driver Tags, keyboard and calibration bridges, so navigation through Workspace loads those pages too. Calibration actions modify fixture memory only; Reload intentionally returns an error for review. Driver Tags group editing wraps, assignments recompose into labelled compact cards, and wide forms retain alignment. No real profile/file writes occur through fixtures.
- **Native:** use existing supported `--user-data-dir` forwarding documented by `tools/perf/run.ts`. A task-owned profile outside the Vite watch tree disables browser-source serving and widgets to avoid installed-app port/window collisions. The native settings control overlay colour matches the charcoal header. No isolation architecture was added. Exact capture dimensions, outcomes and limitations belong in the evidence manifest.

### Iteration 02 parent review

The category definitions and weights above are unchanged. These scores are reserved for the independent parent.

| Category                      | Weight | Parent score |
| ----------------------------- | ------ | ------------ |
| Visual hierarchy              | 20%    | 8            |
| Typography and numerals       | 20%    | 9            |
| Spacing and composition       | 15%    | 8            |
| Colour and contrast           | 15%    | 8            |
| Consistency and finish        | 10%    | 8            |
| Visual restraint              | 10%    | 9            |
| Distinctiveness and character | 10%    | 9            |
| Weighted total                | 100%   | 8.4          |

### 02 — semantic control roles and faithful brand

Corrected existing-logo/red identity after user steering; separated boundary and fill roles across legacy settings; added persistent Workspace access; refined nested grouping, accessible name-format defaults/selection, Driver Tags compact forms and calibration states. Parent scores were pending at implementation handoff; the independent review below now supplies them. Preserve the iteration 01 scores and review above. Evidence, rendered contrast samples, native limitations and exact checks are maintained under `artifacts/settings-design/iteration-02/`.

### Iteration 02 verification and capture provenance

The prescribed preview click/type actions repeatedly timed out; the alternative browser connector reported "The browser access host is unavailable". An isolated non-persistent Playwright/Chrome context then exercised the actual Storybook component tree and exported PNGs at CSS pixel scale. [Playwright screenshots](https://playwright.dev/docs/screenshots) documents page screenshots; [BrowserContext isolation](https://playwright.dev/docs/api/class-browsercontext) documents non-persistent contexts. These are actual rendered components, without image resizing or generated mockup content. Script and per-capture dimensions/URLs/states are in the iteration 02 artifacts.

Native development settings ran with task-owned user data at `C:/Users/tarik/.t3/tmp/irdashies-settings-iteration02-userdata`. The installed app/profile was not used. Initial launch hit port 3000 already in use and a watched-data/native-module rebuild lock; moving the task data outside the Vite tree and disabling the task-profile browser server resolved those setup issues without source architecture changes. Native maximize, restore, minimize (API explicitly reported minimized), and header double-click were observed. Window-control clearance is visible at compact and maximized sizes. Two native drag strokes did not change the recorded origin; free dragging remains unverified rather than passed. Windows capture delivers full-size JPEG; PNG copies preserve dimensions without resizing but do not remove that source compression. The browser wide PNG is a direct lossless 1920 by 1080 export and is the sharper type reference.

### 02 — independent parent review

The parent awards **8.4/10** under the unchanged settings rubric. Typography, restraint and brand character have reached 9: the actual logo/red identity is faithful, type roles are readable across representative sizes, and nested groups are calmer. Keep those gains rather than introducing another aesthetic direction. The parent also opened Workspace in the loaded Driver Tags story and verified Escape closes it and returns focus.

Hierarchy, composition, colour and consistency remain at 8. Header secondary selects need visible contextual labels and closer grouping with their parent row. Compact name-format choices need more even composition, and Driver Tags removal should be a quieter row-associated action rather than a full-width footer. Most importantly, Driver Tags assignment inputs still use borderless `#343d49` fills. The parent's rendered DOM inspection confirmed 0px borders for ID/name/label fields. Fill contrast against `#1b222b` is only 1.46:1, or 1.28:1 against raised `#242c36`. Bring legacy fields into the semantic control system and verify actual field boundaries/focus/errors, not just button samples.

Consider an honest, small font sample driven by the chosen overlay font/weight/size in General appearance: the settings font is deliberately independent, so the user currently has no immediate sample within that form. This is a targeted configuration preview, not a reason to invent telemetry panels. Full review details and the exact scores are preserved in `artifacts/settings-design/iteration-02/parent-review.json`. Native free dragging remains an explicitly unverified implementation concern; it is not being used to invent a visual-score failure.

## Iteration 03 - fields and related options

### Field role and states

`settings-field` is an explicit opt-in Tailwind utility in `src/frontend/theme.css`, parallel to `settings-button`. It applies to settings text/number/search inputs, textareas, native selects and the custom Driver Tags group trigger. It is not a descendant override, and does not style ranges, colour pickers, checkboxes or racing overlays. Fields use existing semantic fill `#242c36`, boundary `#8794a6`, 36px minimum height, 13px normal text `#e0e5eb`, 12px horizontal / 6px vertical inset and 6px radius. Keep width/layout at the call site. Hover brightens the border to `#c5cdd7`, rather than the fill. Disabled fields retain native semantics and use 45% opacity; disabled samples do not certify enabled contrast.

Invalid fields use `aria-invalid`, a red-400 boundary (Tailwind's error red, distinct from the scoped brand accent), an adjacent written error and `aria-describedby`. Invalid hover retains that boundary. Keyboard focus retains the settings-wide 2px light red outline with 3px offset; errors must not erase it. Driver Tags keeps existing duplicate rejection/clear behavior and save callbacks. Its error is now announced as an alert and associated with the conflicting field. Brand and destructive/error meanings still rely on wording and icons as well as red.

The earlier button audit did not cover assignment fields: parent measured zero borders with fill separation 1.46:1 on the page and 1.28:1 on a raised surface. Assignment ID/name/label and group controls now use the same outlined role as General and shared number/select rows. Comparable legacy fields in Profiles, Broadcast, Chromium flags, widget settings and developer tools opt in explicitly. Composite sidebar search keeps one surrounding boundary, avoiding a second box inside it.

[W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) explains measuring meaningful control/state cues against adjacent colours. This motivates checking the actual external surface, including the raised group editor, rather than an abstract token pair. The choice to delineate ordinary fields is ours. Rendered audits measure text, inside/outside boundaries and visible focus after alpha compositing. These are representative samples, not a whole-app conformance claim. Full values and provenance are in the iteration 03 manifest and `browser-evidence.json`.

### Secondary hierarchy and composition

Header/Footer Session Time controls now carry visible **Mode**, **Format** and **Labels** captions in one left-aligned subgrid, indented to the parent label after its drag handle. Session Laps **Mode** and temperature **Units** use the same column rhythm. Wind has a visible **Speed position** caption. Related options stay close to the parent within a 576px maximum subrow. The grid reflows to two columns below the small breakpoint; the reviewed 808px shell fits three time fields. Reorder/enable callbacks and the light inline section rule remain.

[W3C labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) distinguishes visible instructions from accessible naming alone. This supports adding short visible labels to ambiguous secondary selects; it does not prescribe this exact grid. Captions are normal-weight subordinate text, preserving the established type hierarchy.

Name choices have explicit **Name format** context and a consistent two-column compact / three-column wide grid. Options align left, reserve one check slot and use 48px minimum height. Default fallback, selected check and `aria-pressed` remain. Assignment removal is a compact labelled trash action within its own row; the red outlined full-width footer is removed. It has a driver-specific accessible name and 36px target. Its medium grid column is 96px so icon and label fit without overflow.

### Honest appearance sample

General includes a small **Overlay font sample** after font/weight/size. It uses existing `overlay-window`, font-face, font-weight and size classes locally and renders plain text/numerals. It has no telemetry, cross-widget import, store, bridge or persistence change. The caption names the selected configuration. Fixture Lato / Normal / Extra Small yields 12px sample text; Inter / Bold / Large yields 15px / 700. Settings labels retain their own Segoe UI roles. This makes a preference concrete while settings intentionally does not inherit it. There is no new font source: overlay fonts retain existing Google Fonts imports and system fallbacks; the sample does not promise offline delivery of web fonts. Settings remains offline through its installed system font.

### Verification and native limitation

Evidence uses the real isolated Storybook tree and in-memory synthetic fixtures. The prescribed preview rendered the progress image. Two wide screenshot attempts saved 1280 by 720 PNGs although `innerWidth/innerHeight` reported 1920 by 1080. Exact exports therefore use the existing isolated non-persistent Chrome capture strategy; PNG header dimensions are validated against CSS viewports. Nothing is resized to simulate a larger viewport.

The same task-owned native profile outside the watched tree was reused at `C:/Users/tarik/.t3/tmp/irdashies-settings-iteration02-userdata`, via supported `npm start -- -- --user-data-dir=...`. Two supported `sky.drag` strokes, from header points (300,65) and (300,15), moved the pointer but left origin at (879,370), dimensions 802 by 701. Free header dragging remains **unverified**. The API exposes one drag stroke without a hold-duration parameter; these observations do not establish whether the cause is automation or Electron behavior. No drag-region workaround or architecture change was introduced. Iteration 02 native control results remain preserved. The isolated development process is stopped after this investigation; Storybook stays running. Installed user data, app and OS settings were not changed.

### 03 changelog and parent review gate

Added semantic field roles and explicit legacy opt-ins, associated assignment errors, compact row removal, labelled Header/Footer subgrids, stable name choices and an honest font sample. Actual logo artwork, red identity, settings typography and restrained surfaces remain unchanged. New behavioral tests cover secondary-property updates and the sample; browser checks exercise duplicate correction/removal, selected defaults and contrast.

| Category                      | Weight | Iteration 03 parent score |
| ----------------------------- | ------ | ------------------------- |
| Visual hierarchy              | 20%    | 9                         |
| Typography and numerals       | 20%    | 9                         |
| Spacing and composition       | 15%    | 9                         |
| Colour and contrast           | 15%    | 9                         |
| Consistency and finish        | 10%    | 9                         |
| Visual restraint              | 10%    | 9                         |
| Distinctiveness and character | 10%    | 9                         |
| Weighted total                | 100%   | 9.0                       |

### Parent review and stopping decision

The parent independently reviewed the compact Header, name grid and Driver Tags error/focus captures, medium General font sample, and full-resolution wide Footer. Source inspection confirms the font sample uses the existing configured overlay classes and that semantic field roles are explicit opt-in utilities. Test, lint/type and Storybook build logs support the implementation report.

The remaining four categories now earn 9. Visible secondary labels and proximity establish hierarchy; the name grid, compact removal actions and bounded form column resolve composition; semantic field boundaries and written errors resolve contrast and finish. Typography, restraint and the existing red/logo identity retain their previous 9. The font sample supplies useful configuration feedback without ornamental content. Detailed category reasoning is recorded in `artifacts/settings-design/iteration-03/parent-review.json`.

The aesthetic loop stops here for the reviewed settings scope. Weighted progress is **6.3 baseline → 7.7 iteration 01 → 8.4 iteration 02 → 9.0 iteration 03**. These are single-reviewer heuristic judgements under the unchanged seven-category rubric, not validated VisAWI scores, user-study results or an application-wide accessibility certification. Racing overlay aesthetic scores are unchanged.

Native free dragging remains **unverified**: supported automation moved the pointer without changing the window origin. This evidence does not distinguish an automation limitation from application behavior. Prior native window-control checks remain recorded separately; no live iRacing session is claimed. The twenty exact-resolution browser captures and seventeen rendered contrast samples cover representative states, not every possible custom colour or control. Existing overlay web-font loading and fallback behavior remain.

The visual iteration handoff was uncommitted on `t3/settings-ui-redesign`. Publication preparation and the subsequent UX pass use a feature branch. Keep the token roles, brand constraints, fixture states and score history as the baseline for subsequent user-directed changes.

## UX interaction rules and measured pass

The [PR audit record](https://github.com/tariknz/irdashies/pull/880) records the research, ten predeclared tasks, before/after results and limits. Scripted task checks improved from 6/10 to 10/10; modal focus/recovery checks improved from 2/5 to 5/5. These are deterministic workflow checks, not participant success rates or an aesthetic-score revision.

Use **App settings** for the persistent disclosure of app-wide routes. Workspace was an ambiguous metaphor, confirmed by the user's request for its meaning. Existing historical reviews above retain their original term.

Put **Skip to settings** first in keyboard order; reveal it on focus and send focus to the main region. On a settings route change, focus main so navigation does not strand focus in a hidden disclosure. Do not focus main on initial mount or while merely filtering overlays. The measured Relative fixture had 66 focusable controls before main; the shortcut reaches main with Tab and Enter.

Every settings reorder row has a single-pointer/keyboard alternative to dragging: quiet, always-available 36px native Move up/Move down buttons using the existing reorder callback. Retain the drag handle. Disable unavailable directions; at a boundary keep focus on the other direction in the same row and announce the move. Do not hide these actions behind hover or require a drag gesture.

Destructive confirmations start on Cancel, contain forward/backward Tab, make background branches inert, dismiss with Escape and restore the connected invoker. If confirmation removes or disables the invoker, focus main as the logical recovery point. Preserve prior inert state when closing or unmounting. Short confirmation messages are associated using `aria-describedby`.

Driver group choices retain native buttons and selected-state feedback. Escape closes and restores trigger focus; selecting closes and returns focus; tabbing outside closes without stealing focus. Expose the current value as the trigger's accessible description. Do not add a combobox/listbox role without implementing its complete keyboard contract.

Maintain the existing red/logo identity and typography. Keyboard improvements do not justify decorative panels or prominent repeated reorder chrome. This pass adds no telemetry, storage, bridge, dependency or persisted-schema changes. Research references and remaining real-user/native verification needs are in the PR audit record. Review media and machine-specific audit scripts are local evidence, excluded from source commits.

Publication self-review preserves the intent of upstream PR #873: do not add a redundant sidebar widget count. The Overlays heading supplies context; filtering and the no-results status communicate search outcomes without a persistent total.

The parent inspected the final compact Header/Display, focus-only skip link, General, wide Footer and confirmation captures after the UX changes. Quiet, borderless reorder arrows preserve the form hierarchy and restraint. All seven aesthetic categories retain 9/10 in this representative settings review; the separate UX result remains 10/10 scripted tasks rather than an invented usability rating.

## PR review follow-up — 6 November 2026

The initial review covered representative views and ten selected tasks; it did not establish that every route, modal and repeated interaction was consistent. An exhaustive view audit is separate work. PR review exposed ten distinct issues across eleven threads, including duplicate reports of repeated move announcements. Preserve that coverage limit when interpreting the earlier scores.

- Use the shared `ConfirmDialog` for Reset Position, retaining the exact reset action/message while gaining Cancel-first focus, Tab containment, Escape dismissal and focus recovery.
- Reorder announcements include the new one-based position and item count so consecutive moves produce meaningful live-region changes. Restore focus to the used button after every move, using the other direction only at a boundary; keyed DOM reinsertion can otherwise blur a middle-row control.
- Legacy range tracks use the explicit `settings-track` role rather than a neutral control fill. Browser measurements, including composited CSS colours, give 4.94:1 against the Fuel panel and 5.20:1 against the legacy Inspector page. These are track/surrounding measurements, not a complete slider or screen-reader certification.
- A Fuel layout's instance ID remains in the persistent page description on all five tabs. Driver group triggers identify their row by name/ID; the selected group remains an accessible description. Appearance field headings sit at h4 below the h3 section.
- Below the lg breakpoint, the Fuel editor reserves 300px and its available-widget pool scrolls within 240px. The pool spans the column width; at lg the existing 450px row layout and 192px pool return. The compact rendered drop area is 265px high, and medium/wide drop areas are 415px. No horizontal page overflow was measured at 808, 1280 or 1920px.
- Choosing the current app-wide route returns focus to the disclosure trigger, since no pathname change occurs to trigger main-region focus. The Key Bindings fixture resets only the requested action, preserving other edited shortcuts.

Focused component regressions cover repeated moves in both directions, reset/cancel semantics, all Fuel tab identities, heading ranks, row-specific labels and same-route navigation. Browser fixtures additionally verify geometry, range contrast, live-region changes, focus recovery and single-shortcut reset isolation. The legacy Inspector is excluded from SettingsLoader; its contrast fixture is a standalone story and does not reintroduce a production route. Review media remains outside the source worktree.

Validation for this follow-up: full suite 5,703 passed / 4 skipped across 489 files; 251 settings tests across 37 files; TypeScript/ESLint, Storybook production build, formatting and diff checks passed. The isolated Chrome protocol reports no page errors. No additional live iRacing or native free-drag testing is claimed.

The subsequent review identified an additional saved-order edge case: Header/Footer arrays can retain IDs with no configuration. Such invisible entries must not count as move targets or announcement positions. Sort the rendered rows, then merge their new order into the original visible slots while retaining unconfigured IDs in their original slots. Disabled-but-configured rows remain visible and participate normally. A regression covers moves in both directions with hidden entries before, between and after the rendered rows, including accurate position feedback and preservation of the full saved order.

Validation of that edge-case follow-up: 5 SessionBarItemsList tests and the full local suite pass (5,704 passed / 4 skipped); TypeScript/ESLint, formatting and diff checks pass.

Prior parent iteration 02 scores remain 8 / 9 / 8 / 8 / 8 / 9 / 9, total 8.4. The parent alone awards iteration 03 scores under unchanged definitions and weights.

## Complete-view audit findings and coverage limits — 6 November 2026

The independent [complete settings audit](docs/research/settings-complete-view-audit.md) is pinned to `d936a4ec54b2860df73666e91046267b80e6db5c`. It preserves the score history above and the original seven-category rubric and weights. The earlier all-9 result covered representative views; it is not an all-pages assessment.

The exhaustive navigation inventory contains 100 base route/tab views across 34 widget routes and eight app-wide/bottom routes, 19 Radar section/depth views (one entry alias) and 18 repeated editor route/tabs: **136 distinct route/tab views**. Each was rendered at 808×656, 1280×800 and 1920×1080; all 100 base views also have separate LMU evidence. Compact/preferred review includes scrolling; wide review combines per-view geometry with representative visual inspection. The external ledger distinguishes that coverage explicitly.

**74 of 136 views have at least one aesthetic category below 9; 62 meet all seven targets in the inspected states.** Broadcast compact containment, Profile action menus, Radar's competing configuration layers, custom layout-editor treatment, action roles and Advanced Telemetry are the main discrepancies. General, common visibility forms and the refined Header/Footer subgrids remain strong examples. These are independent heuristic judgements, not real-user results or accessibility certification.

The full ledger has 479 rows: 406 inspected view/state rows, 54 shared menu/control rows, 17 native visual states blocked by the headless capture boundary and two unreachable candidate states. It indexes 2,380 exact-resolution screenshots. All media, fixtures and capture artifacts live outside the worktree in `C:/Users/tarik/.t3/review-media/settings-complete-view-audit`; exact evidence, category scores, priorities and limits are linked from the audit. Native dialogs/choosers are not silently counted as passed. Arbitrary combinations of configuration values are not additional navigation views.

The parent subsequently supplied `6cbc1fe5d7759be9bcba9ed96af691b7ce9978c0`. Its source diff fixes Reset Position's dialog family, reorder announcements/focus, compact Fuel sizing, selected range tracks/naming, persistent Fuel instance identity, appearance heading ranks, driver-specific group names, same-route focus and a shortcut fixture reset. The audit records these as newer-head corrections pending a rendered integration re-check; its baseline evidence and scores are not erased or presented as current-head validation. Widget Scale and navigation changes remain owned by their separate threads.

This audit makes no production UI or startup-size change. Keep the actual logo artwork, red identity, settings-owned typography, overlay preferences and telemetry/profile/storage/IPC semantics intact when addressing the findings. A future all-view claim requires rechecking the affected inventory rows, including compact and expanded/error states, rather than extending representative scores to unreviewed views.

## Widget Scale ownership

Widget Scale belongs inside the first relevant widget configuration section,
in its existing route and tab. Use `SettingsSection.scaleWidgetId` for shared
containment and spacing, not a standalone scale card or caller padding. Keep
specific Display Order, Columns and Minimal Styling names as subordinate
headings under Display/Styling. Use Widget options for general widget controls.
Radar retains its existing Look section and search/level rules; the shared
row's `separated` option supplies the same quiet rule when controls follow.

Keep the visible label, percentage, native slider and labelled Reset action
together. Reset remains disabled at 100% and returns focus to the slider after
activation. Preserve the existing scale setter, normalization, 50-200% range,
5% steps, default, instance targeting and persistence callback. Specialised
font, gear, graph, physical-distance and nested Gantry scale models remain
independent.

Reuse existing settings colour/type roles. The scale label uses the 14px
control role, percentage uses 13px tabular numerals, and Reset uses a 16px
Phosphor icon plus visible 13px text. Disabled Reset uses slate-500 text without
opacity, retaining legibility while its native disabled state communicates
availability. Enabled text uses slate-300 and hover uses slate-200 on slate-700;
the existing red keyboard outline remains.

Bound the shared row to 36rem (`max-w-xl`) with a 7rem label column, flexible
slider, 3rem value and 5rem Reset column. Use 12px column gaps and an 8px row
gap. Below a 24rem container width, place the label above slider/value/reset.
This responds to narrow Radar/Broadcast forms even inside a wide window.
The range target is 24px high and Reset is 80 by 36px. Scale-owning panels use
8px heading separation, a 12px inset before the quiet rule and 16px separation
before following controls. Other panels retain their established spacing.

[WAI grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
supports visual and programmatic relationships: the visible label names both
the native range and its enclosing group. Reusing an existing panel instead
of adding a card is the local design choice. The
[WAI slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
informs percentage semantics, arrow steps and Home/End behavior. Keep native
keyboard handling. [WCAG target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
informs the slider/reset targets without changing scale values or semantics.
