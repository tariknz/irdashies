---
name: publish-pr
description: Publish GitHub pull requests for this repository. Use this skill whenever the user asks to create, open, raise, or publish a PR. Follow the repository's pull request template exactly, default to a published/ready-for-review PR unless the user explicitly requests a draft, and write a conventional-commit-style title that describes the user-visible problem solved or outcome achieved.
---

# Publish a Pull Request

Publish the current work as a GitHub pull request, ready for review by default.

## Workflow

1. Read `AGENTS.md`, `.github/pull_request_template.md`, and relevant contribution guidance.
2. Inspect the worktree, current branch, diff, commits, and remote. Never commit directly to `main`.
3. Determine the intentional PR scope. Preserve unrelated user changes. Run checks appropriate to the changed files and report any checks that cannot be run.
4. Create or use a correctly named feature branch, commit the intended changes with the repository's commit convention, and push the branch when needed.
5. Derive the PR title from recent PR history and the rules below.
6. Build the PR body from `.github/pull_request_template.md` without deleting or renaming its sections. Fill in every applicable section and check only items actually completed. For screenshots, provide the requested before/after evidence or clearly state when screenshots are not applicable.
7. Create the PR as published and ready for review unless the user explicitly asks for a draft. Treat silence about publication state as a request for a published PR.
8. Verify the created PR has the requested publication state and return its title and URL. If the user did not request a draft and tooling unexpectedly creates one, immediately mark it ready for review and verify again.

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

- Start from the current repository template rather than recreating it from memory.
- Explain the problem, its effect, and how the PR resolves it in the Description.
- Include exact validation performed and distinguish automated, Storybook, manual, and real-environment testing.
- Do not check a checklist item based on intention or inference.
- Do not claim iRacing or other live-environment testing unless it was actually performed.
- Preserve Before and After screenshot headings.

## Publication Guardrail

Published means ready for review, not merely pushed to a remote. Unless the user explicitly requests a draft, confirm the PR's draft flag is false before completing the task. When the user explicitly requests a draft, create and verify a draft PR instead.
