# Code Signing with SignPath

irDashies uses the [SignPath Foundation](https://signpath.org/) OSS program to
Authenticode-sign three Windows executables: the Electron application, Squirrel's
generated launcher, and the final installer. Signing identifies the publisher;
it does not guarantee that antivirus software will accept a release.

## How it works

The [release workflow](../.github/workflows/ci.yml) uses two SignPath requests:

1. Forge packages the app and makes the Squirrel artifacts, saving its make
   manifest. This generates `irdashies_ExecutionStub.exe` inside the full `.nupkg`.
2. CI copies that full package to `squirrel-package.zip` and uploads it. SignPath
   signs both `lib/net45/irdashies.exe` and
   `lib/net45/irdashies_ExecutionStub.exe` inside the package in one request.
3. [rebuild-squirrel.ps1](../tools/signing/rebuild-squirrel.ps1) verifies both
   signatures, restores the `.nupkg` filename, and writes a new `RELEASES` entry
   using the signed package's SHA1 and byte count.
4. Squirrel rebuilds `Setup.exe` from that signed **full** package and manifest.
   Full packages skip Squirrel's package transformation, so the signed launcher
   is preserved. CI verifies that the package bytes and manifest remain intact.
5. The second SignPath request signs the final `Setup.exe`. CI verifies its
   signature, then releases from Forge's saved make results.

The final artifacts retain the paths recorded by Forge. Fresh installs receive
the same signed package as auto-updates. The pipeline currently produces a
single full package; the rebuild script rejects delta packages rather than
publishing a delta derived from different bytes.

### Why the launcher needs signing

Squirrel installs `irdashies_ExecutionStub.exe` as
`%LocalAppData%\irdashies\irdashies.exe`. It starts the actual application under
`app-<version>`, allowing shortcuts to keep a stable target across updates.

Signing the application before `make`, then signing only `Setup.exe` afterward,
misses this generated launcher. Squirrel's normal integrated signing handles
generated executables during packaging; our remote SignPath artifact workflow
signs the generated application and launcher together afterward.

See [Squirrel's signing guide](https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/application-signing.md)
and [SignPath's nested signing syntax](https://docs.signpath.io/artifact-configuration/syntax).

### Package checksums

Signing inside a `.nupkg` changes its bytes. The old `RELEASES` SHA1 and size
must be regenerated, and the installer must embed that updated package and
manifest. Nothing inside the package changes after the installer is signed.

## SignPath portal setup

The repository XML files are reviewable copies. A SignPath organization owner
must also configure them in the portal; changing files here does not update
the service.

| Artifact configuration slug | Repository configuration                                                          | Purpose                                              |
| --------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `squirrel-package`          | [squirrel-package.xml](../.signpath/artifact-configurations/squirrel-package.xml) | Sign the application and generated launcher together |
| `initial`                   | [initial.xml](../.signpath/artifact-configurations/initial.xml)                   | Sign the final installer                             |

For an existing setup, add `squirrel-package` before running the new release
workflow. It replaces the previous `packaged-app` signing request; that portal
configuration is no longer used. The `initial` signing rules remain the same.

The new configuration includes two ZIP levels: GitHub's artifact ZIP contains
`squirrel-package.zip`, which contains the full NuGet package contents. SignPath
extracts the outer ZIP into `signed-squirrel-package/` when returning the result.

For a new setup:

1. Install the [SignPath GitHub App](https://github.com/apps/signpath) on
   `tariknz/irdashies`, and link the GitHub.com trusted build system to the project.
2. Add both artifact configurations above to the SignPath project.
3. Set GitHub Actions secret `SIGNPATH_API_TOKEN` and repository variable
   `SIGNPATH_ORGANIZATION_ID`.
4. Confirm the project slug is `irdashies` and the production signing policy
   is `release-signing`.

## Validation

The Windows test job runs `tools/signing/rebuild-squirrel.spec.ps1`. It checks
manifest refresh after package changes, then exercises the bundled Squirrel
rebuild and extracts the installer's payload to verify that the full package
and manifest match. The manifest checks also run under PowerShell on macOS;
the native Squirrel checks require Windows.

The release job requires valid signatures on the application, launcher, and
installer before publishing. For a signing smoke test, run the workflow manually
with `signing_smoke_test` enabled and `should_release` disabled after configuring
the portal. This runs the full signing flow and uploads the results as the
`signed-windows-test-artifacts` CI artifact without creating or changing a release.
Download those artifacts to check fresh installation, the installed launcher
signature, and auto-updates on Windows. The signing policy must allow the test's
source branch; any configured signing approvals still apply.

Normal releases are triggered by a version change on `main`. A draft is not
offered to users until it is published; prereleases are also skipped by the
[update service](https://github.com/electron/update.electronjs.org/blob/main/src/updates.ts).
