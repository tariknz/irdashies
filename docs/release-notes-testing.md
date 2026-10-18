# Release notes: development and testing

The app reads Markdown from the exact installed version's public GitHub release
(`vVERSION`, then `VERSION`). It never substitutes the latest release. Settings →
Release notes is always available. The dialog appears only in Settings,
once after upgrading from a previously recorded version. First installs,
unchanged versions and downgrades do not automatically open it. The first launch
of an app containing this feature establishes the baseline; installations from
before the feature have no recorded prior version.

The auto-show preference, pending dismissal, unread version and five most recent release
bodies are global application data in `release-notes.json`, independent of
profiles. Cached notes display immediately and refresh in the background at most
once per five minutes while the app is running. Markdown and GitHub's image/video
HTML are sanitized before rendering. Screenshots, animated GIFs and videos from GitHub attachments, GitHub user images and this
repository's raw files display inline. Videos have controls and do not autoplay;
external HTTP(S) links open in the system browser. Cached notes store text only:
remote media still needs connectivity, and each item has an external fallback
link if it cannot be loaded.

## Test without publishing a release

For the menu and badge, Storybook **components / SettingsLayout / New Release
Notes Badge** starts with automatic dialogs disabled and unread notes. Click
Release notes: the badge clears after the local fixture loads. **Release Notes
Page** previews the permanent page directly.

Run `npm run storybook`, then open **Settings / Release notes**. Stories cover
normal, long, loading, empty, offline, unpublished and cached notes, unsafe
Markdown, and the actual modal dialog. **Live Media** is an explicit network
story with real published PNG/GIF screenshots and a video attachment (including
GitHub's bare, extensionless URL format). Verify images load, the GIF animates,
video controls work without autoplay, and narrow windows do not overflow. In the
dialog, verify Tab stays inside, Escape closes, and focus returns to the opening button when reopened.

In an unpackaged app, Settings → Release notes also has **Preview update dialog**.
This uses local sample Markdown and never changes the dismissal state.

For the full restart/persistence flow, run from the repository:

```sh
npm run release-notes:preview -- --previous 2.0.0 --current 2.1.0 --state upgrade-test
```

Open Settings: sample notes for 2.1.0 should appear. Click Done, fully quit, then
run the same command again: the dialog should stay dismissed. Open Settings →
Release notes to view them again. Reusing a `--state` value keeps that simulation;
a new value starts fresh. The Release notes item is in the bottom Settings menu,
directly before About. Its **New** badge persists across restarts until the installed notes
successfully load on that page, or a successfully loaded update dialog is
dismissed. Loading failures keep the badge visible. First installs and downgrades
do not create a badge. Turning off automatic dialogs retains the unread badge;
re-enabling automatic dialogs does not retroactively open a suppressed dialog.
Only release-note data is isolated; ordinary dashboard
settings remain the app's usual development settings.

Other fresh scenarios:

```sh
# First install: no automatic dialog
npm run release-notes:preview -- --current 2.1.0 --state first-install-test

# Downgrade: no automatic dialog
npm run release-notes:preview -- --previous 2.1.0 --current 2.0.0 --state downgrade-test

# Another upgrade, using the persisted upgrade-test state
npm run release-notes:preview -- --current 2.2.0 --state upgrade-test

# Read an existing public release instead of the fixture (no publishing)
npm run release-notes:preview -- --previous 1.9.0 --current 2.0.0 --state live-test --live
```

Turn off **Show release notes after updates**, quit and simulate a newer version
with the same state key: no automatic dialog should appear. Re-enabling it does
not retroactively show dismissed or suppressed notes. Failed/unpublished loads
are not acknowledged by closing the dialog, so reopening Settings can retry.
Disconnect the network after a successful live fetch and restart to verify saved
notes display; use a fresh state key to verify the error and retry UI.

Simulation uses `release-notes-preview-<state>.json` inside Electron userData and
sample Markdown by default. The launcher sets `IRDASHIES_RELEASE_NOTES_CURRENT`,
`IRDASHIES_RELEASE_NOTES_PREVIOUS`, `IRDASHIES_RELEASE_NOTES_STATE` and
`IRDASHIES_RELEASE_NOTES_LIVE`. All overrides are ignored in packaged builds.
It does not trigger update checks, downloads or installations.

## Update offered by the existing updater

The updater's `update-available` event does not include the target version.
After `update-downloaded`, if Electron supplies a valid version in `releaseName`,
the notes page offers **Downloaded update: VERSION**. Reopen the notes page or
refocus Settings after a download. The existing update prompt and install flow
are unchanged. No additional feed polling is introduced.

## Automated checks

```sh
npx vitest run --no-coverage src/app/bridge/releaseNotesBridge.spec.ts src/app/releaseNotes src/app/storage/releaseNotes.spec.ts src/frontend/components/Settings/ReleaseNotes
npm run lint
```
