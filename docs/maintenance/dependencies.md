# Dependency maintenance

Last reviewed: 8 November 2026.

## Scoped security overrides

`package.json` overrides modern `glob` (versions 9 through 14.0.1) with
14.0.4 or later, and modern `minimatch` (versions 7 through 11.0.0) with
11.0.5 or later. These are major-version overrides for the build tools,
including Electron ASAR packaging, Storybook and ESLint. They address:

- [Glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).
- [Minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).

The project's Node >=24 requirement satisfies both replacements. Their
matching semantics differ from the previous majors: retain lint, Storybook
build and packaging checks when changing these overrides. Remove the overrides
when the consuming packages declare patched versions themselves.

Legacy callback-based `glob@7` and `minimatch@3` are deliberately outside the
override ranges. Replacing them globally with modern promise-based APIs breaks
older packaging consumers.

## Remaining upstream issues

`electron-winstaller@5.4.4`, the latest version at review time, still depends
on `temp@0.9.4` and `@electron/asar@3`. These bring deprecated `rimraf@2`,
`glob@7` and `inflight@1`. They belong to the Windows installer build chain;
they are not runtime telemetry dependencies. Removing unused DEB/RPM makers
reduces the graph but does not remove this Windows dependency chain.

The DMG chain is `@electron-forge/maker-dmg` -> `electron-installer-dmg` ->
`appdmg@0.6.6` -> `image-size@0.7.x`. Audit reports
[an ICNS parser denial of service](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
The patched `image-size@2.1.0` has a different export and file-reading API;
a direct override is not compatible with appdmg's old usage. Fixing this
requires an upstream appdmg change or a separately validated replacement of
the DMG builder on macOS. Existing installer support is retained.

After this maintenance, audit reports four high-severity affected packages
from that single DMG issue, no moderate findings, and zero findings with
`--omit=dev`. These counts are a point-in-time registry observation, not a
claim that every dependency is free of security issues.

Do not apply `npm audit fix --force` blindly: the reported fix suggestions
included downgrading Forge and other tools across major versions.

## Routine updates

Use `npm update` to refresh versions within the declared ranges, then check
TypeScript/ESLint, the full test suite, Storybook and Electron packaging.
TypeScript 7 and jsdom 31 are separate major migrations. youtubei.js remains
pinned to 18.1.0 and requires an explicit compatibility review before updating.
Windows Squirrel and macOS DMG installers require validation on their own OS;
a successful Linux package does not establish that those installers work.
