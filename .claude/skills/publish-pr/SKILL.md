---
name: publish-pr
description: Publish GitHub pull requests for this repository. Use this skill whenever the user asks to create, open, raise, or publish a PR. Follow the repository's pull request template exactly, default to a published/ready-for-review PR unless the user explicitly requests a draft, and write a conventional-commit-style title that describes the user-visible problem solved or outcome achieved. Continue with babysit-pr when monitoring or review-comment handling is requested.
---

# Publish a Pull Request

Publish the current work as a GitHub pull request, ready for review by default.

## Workflow

1. Read `AGENTS.md`, `.github/pull_request_template.md`, and relevant contribution guidance.
2. Inspect the worktree, current branch, diff, commits, and remote. Never commit directly to `main`.
3. Determine the intentional PR scope. Preserve unrelated user changes. Run checks appropriate to the changed files and report any checks that cannot be run.
4. Create or use a correctly named feature branch, commit the intended changes with the repository's commit convention, and push the branch when needed.
5. Check whether the current branch already has an open or draft PR. Reuse and update it instead of creating a duplicate.
6. Derive the PR title from recent PR history and the rules below.
7. Copy `.github/pull_request_template.md` verbatim for the PR body. Preserve every heading, HTML comment, checklist entry, and their order. Fill in applicable placeholders and check only items actually completed. Every visual change requires actual screenshot attachments as described below. Only changes with no visual impact may mark screenshots as not applicable.
8. Update the existing PR or create a new one as published and ready for review unless the user explicitly asks for a draft or required screenshot uploads remain blocked. Treat silence about publication state as a request for a published PR once all requirements are satisfied. If an existing PR is a draft and the user requests publication, mark it ready for review only after required screenshots are attached.
9. Verify the PR has the requested publication state and required screenshot attachments. If the user did not request a draft and tooling unexpectedly leaves one, mark it ready for review and verify again only when its screenshot requirements are satisfied.
10. When the user also requests monitoring, babysitting, or handling review comments, continue with [babysit-pr](../babysit-pr/SKILL.md). Otherwise return the PR's title and URL after publication verification. Publishing alone does not start an ongoing watch or authorize merging.

## Title Rules

Use the conventional prefix and casing style found in recent PR history:

```text
<type>: <problem solved or outcome achieved>
```

Choose the type that matches the work, such as `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`.

Describe the problem that is now solved or the capability the user now has. Do not merely name the implementation action, internal symbol, file, bridge, or refactor.

Good:

```text
fix: site missing session bridge causing it to not load
```

Avoid:

```text
fix: initialize browser session bridge
```

Keep the title concise, concrete, and understandable without reading the diff. Prefer the repository's established wording when history provides a close precedent, but apply the problem/outcome rule even if an older title was implementation-focused.

## PR Body Rules

- Copy the current repository template verbatim rather than recreating it from memory. Preserve all headings, HTML comments, checklist entries, and their order.
- Explain the problem, its effect, and how the PR resolves it in the Description.
- Include exact validation performed and distinguish automated, Storybook, manual, and real-environment testing.
- Do not check a checklist item based on intention or inference.
- Do not claim iRacing or other live-environment testing unless it was actually performed.
- Preserve Before and After screenshot headings.

## Review Images and Videos

- Every visual change must be shown to the user with a screenshot in the final response and have actual screenshots uploaded as GitHub attachments in the PR body. Include Before / After images for changes to existing UI, and at least an After image for new UI. Prose descriptions, Storybook links, and local image paths are not substitutes.
- Keep review screenshots and recordings outside the repository worktree, such as in a temporary directory. Do not commit them to `docs/assets/pr-reviews/` or any other repository path. This does not prevent adding product assets that the user explicitly requested as part of the implementation.
- Before uploading, check the selected subcommand's `--help` for `--attach` (for example, `gh pr comment --help`). If the installed CLI lacks it, check the current official release and use an updated CLI before declaring upload unavailable. A checksum-verified portable release outside the worktree can use existing authentication without changing the installed CLI. Do not run the examples below unless the selected command advertises the flag.
- Check the CLI that will actually perform the upload:

  ```bash
  gh --version
  gh pr edit --help
  ```

  If the installed CLI needs upgrading on Windows and that upgrade is authorized, use:

  ```powershell
  winget upgrade --id GitHub.cli --exact --silent --disable-interactivity
  ```

  Windows may request administrator approval. Leave that prompt for the user; do not automate it or report the upgrade complete before it finishes. Re-run `gh --version` and check the attachment flag afterward. If using a portable release instead, run these checks against that executable's full path.

- When supported, upload directly with `gh pr create`, `gh pr edit`, or `gh pr comment` and `--attach`. If the flag is absent, try an authenticated GitHub browser upload instead. If uploads remain blocked, keep the visual PR in draft, report the exact blocker, and continue recovery where possible. Do not claim publication is complete until screenshots are attached; do not commit review assets as a workaround.
- For a comment attachment when `--attach` is supported:

  ```bash
  gh pr comment <PR-NUMBER> --body 'Review screenshot' \
    --attach '/path/to/image.png#Screenshot of bug fix'
  ```

- To place media under the template's Before/After headings, write the body to a temporary file with local Markdown references, then pass that file and the same media paths to `gh pr create` or `gh pr edit`:

  ```bash
  gh pr edit <PR-NUMBER> --body-file /tmp/pr-body.md \
    --attach /tmp/screenshot.png --attach /tmp/replay.mp4
  ```

  Use `![Screenshot](/tmp/screenshot.png)` for an image and `![](/tmp/replay.mp4)` in its own paragraph for a video player. `gh` replaces the local references with uploaded attachment URLs. Repeat `--attach` for additional files.

- Read back the PR body and verify that the uploaded attachments render and no local paths or repository-hosted review media links remain. A normal GET of each image URL can also verify delivery; do not treat a failed HEAD request alone as proof the attachment is broken. If an upload partially fails, inspect the saved body before retrying to avoid duplicates.

## Publication Guardrail

Published means ready for review, not merely pushed to a remote. Visual PRs also require verified screenshot attachments before they can be marked ready for review. Unless the user explicitly requests a draft or screenshot uploads remain blocked, confirm the PR's draft flag is false before completing the task. When the user explicitly requests a draft or required screenshot uploads remain blocked, create or retain and verify a draft PR instead, and explain any blocker. Never create a duplicate PR when the branch already has one.
