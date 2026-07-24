# Code Signing with SignPath

irdashies is signed through the [SignPath Foundation](https://signpath.org/)
OSS program. The Windows installer (`Setup.exe`) is Authenticode-signed in CI so
Windows SmartScreen recognises it as coming from a known publisher.

## How it works

SignPath is a **remote** signing service: CI uploads the unsigned artifact,
SignPath signs it and CI downloads it back. Signing happens between building and
publishing, wired into [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

1. `electron-forge publish --dry-run` builds the Squirrel artifacts
   (`Setup.exe`, `-full.nupkg`, `RELEASES`) into `out/make/…` and saves a
   publish manifest **without uploading**.
2. Only `*Setup.exe` is uploaded as a GitHub Actions artifact.
3. The `signpath/github-action-submit-signing-request` action submits it and
   waits for the signed installer, downloaded to `signed-installer/`.
4. The signed `Setup.exe` is copied back over the one in `out/make/…`.
5. `electron-forge publish --from-dry-run` uploads the release. The dry-run
   manifest references files by path, so the swapped-in signed installer is what
   gets published; `RELEASES` and the `.nupkg` are never modified.

### Why only `Setup.exe`?

Signing the `Setup.exe` as a single PE file (Authenticode) covers the whole
installer, including its embedded `.nupkg`. We intentionally do **not** deep-sign
inside the `.nupkg`: doing so changes its bytes and invalidates the SHA1 recorded
in `RELEASES`, which breaks `update-electron-app` / Squirrel auto-updates.

The signing rules live in
[`.signpath/artifact-configurations/initial.xml`](../.signpath/artifact-configurations/initial.xml).

## One-time setup

These steps happen outside the repo and must be done by a repo admin / SignPath
org owner.

### 1. Install the SignPath GitHub App

Install <https://github.com/apps/signpath> on the `tariknz/irdashies` repo. In
the SignPath portal, add the predefined **GitHub.com** trusted build system to
the organization and link it to the project.

### 2. Edit the artifact configuration in the portal

SignPath auto-creates one artifact configuration per project (named "Initial
version", slug `initial`). Open it, edit the XML, and paste the contents of
`.signpath/artifact-configurations/initial.xml`. Keep the portal copy and the
repo copy in sync.

### 3. Add GitHub secrets and variables

In **Settings → Secrets and variables → Actions**:

| Kind     | Name                       | Value                                           |
| -------- | -------------------------- | ----------------------------------------------- |
| Secret   | `SIGNPATH_API_TOKEN`       | User API token from the SignPath portal         |
| Variable | `SIGNPATH_ORGANIZATION_ID` | Organization ID (GUID) from the SignPath portal |

The org ID is not secret, so it is a repo **variable**; the API token is a
**secret**.

### 4. Verify the slugs

The workflow assumes these SignPath slugs (the defaults). Confirm they match your
project in the portal and update the workflow if not:

- `project-slug: irdashies`
- `artifact-configuration-slug: initial`
- `signing-policy-slug: release-signing` (production; `test-signing` for one-off test runs)

## Signing policy

The workflow signs with the `release-signing` policy (production certificate,
publicly trusted), so released builds are not flagged by SmartScreen.

To sign with the self-signed `test-signing` policy instead (e.g. for a one-off
validation run), temporarily change `signing-policy-slug` in the workflow.

### Testing without affecting users

The GitHub publisher creates **draft** releases (its default), and
`update.electronjs.org` skips both **draft** and **prerelease** releases (see
[`src/updates.ts`](https://github.com/electron/update.electronjs.org/blob/main/src/updates.ts)),
so a test release is never offered to any user's auto-updater until you manually
publish it.

To validate the pipeline:

1. Bump the version in `package.json` and push to `main`.
2. CI builds, signs the installer with the test cert, and creates a **draft**
   release with the signed `Setup.exe` attached.
3. Download the `Setup.exe` and confirm it is signed (right-click → Properties →
   Digital Signatures, or `Get-AuthenticodeSignature`). It will chain to the
   SignPath test cert, so other machines still warn — that is expected.
4. Delete the draft release when done.

### Going to production

The production certificate has been issued and the workflow signs with
`release-signing`. A normal "bump version → push `main`" release is
production-signed automatically; no further changes are needed.
