---
name: release-notes
description: Generate, review, or update user-facing release notes from GitHub PR descriptions for a version or comparison range.
disable-model-invocation: true
---

# Release Notes Generator

Generate release notes for the given version tag or range. The user will provide the version (e.g. `v0.1.0`) or a comparison range (e.g. `v0.0.41...v0.1.0`).

Read the version, comparison range, source notes, and output preferences from the user's request or conversation. In Claude Code, invocation arguments are also supplied as `$ARGUMENTS`; in Codex, use the text accompanying `$release-notes`. Ask for any required input that is missing.

## Step 1: Get the PR list

Use `gh` to get all merged PRs in the release range. If the user provides a single version tag, find the previous released tag to build the comparison range. For a GitHub release URL, resolve the release's actual tag, target commit, and draft status first; a draft's `untagged-*` URL is not its version tag. If the tag does not exist yet, use the draft's target commit and record the resolved commit used for the review.

```bash
# Find the previous tag if needed
git tag --sort=-v:refname

# Get the commit range
git log <previous-tag>..<version-tag-or-target-commit> --oneline

# Extract PR numbers from merge commits or commit messages
```

Confirm the PR list against the actual commits in the range, rather than assuming the existing release body is complete.

## Step 2: Fetch every PR description

For each PR, fetch the title, body, and author using `gh`:

```bash
gh pr view <number> --json title,body,author
```

**This is critical:** do NOT write release notes from PR titles alone. You MUST read the full PR description body to understand what each change actually does.

### Accuracy rules

- Base each feature or fix claim on the authored PR description. Automated summaries and titles can omit limitations or include removed changes; use the merged diff to resolve conflicts or ambiguity.
- Describe the final behavior across related PRs. A prerequisite PR or screenshot can be outdated after its follow-up lands, and stacked PR descriptions can repeat changes owned by other PRs.
- Compare each claimed fix, enhancement, or performance improvement with the previous release. If the affected feature or capability first ships in this release, fold its follow-up PRs into the feature's final behavior instead of presenting them as fixes or add-ons to something users already had. Apply this to new capabilities within existing widgets too. Keep the complete PR changelog as a source record, but do not let commit prefixes determine the user-facing grouping.
- Preserve material limits: supported simulators/widgets, estimates versus measured positions, local recording requirements, partial fixes, settings that require a restart, and changes that apply only to new installs or resets.
- For beta or partial integrations, show the maturity status supplied by the user or sources prominently, confirm the shipped widget subset and setup requirements against merged code, and list practical gotchas. Internally available telemetry does not prove a widget is supported; check the shipped compatibility list and its consumers.
- Keep development tools distinct from features available in the packaged app. Do not turn test results into claims of live simulator validation, or imply performance gains beyond the evidence provided.

## Step 3: Write the release notes

Use a user-specified output path when provided; otherwise write the notes to `~/Desktop/irdashies-demos/release-<version>.md`. Resolve `~` to the current user's home directory and create the output directory if needed. Follow an explicit request to edit the GitHub release directly instead: read its current body, preserve existing user edits and relevant images, and update the notes only. Preserve the title, tag, target, assets, and draft/published state; editing a draft does not authorize publishing it.

### Tone and audience

- **User-facing:** write for sim racers who use the app, naming the relevant simulator where behavior differs
- **No technical jargon:** no internal code references, function names, variable names, file paths, algorithm descriptions, hook names, or architecture details; user-facing file formats such as `.ibt` or CSV are useful when explaining imports
- **Describe what changed for the user:** explain what they'll see, what they can now do, and what is fixed; include a concrete use case when it makes the benefit clearer
- **Keep it concise:** one clear sentence per bullet point where possible
- **No em dashes:** use colons, commas, or separate sentences throughout the notes, including copied changelog titles

### Document structure

```markdown
## Features

### Feature Name (by @author)

Brief description of the feature.

- Bullet points describing what users can do

### ...more features...

### Performance Optimizations (by @author)

- **Short label:** describe the user-visible improvement (e.g. "smoother rendering"), not the implementation

### Bug Fixes

- **Short label:** one-line description of what was broken and what's fixed now (by @author)

### Changelog

- commit-prefix: title by @author in PR-URL
- ...

### New Contributors

- @user made their first contribution in PR-URL

**Full Changelog**: compare-URL
```

### Grouping rules for the Features section

- Group related PRs when they describe one cohesive feature. Give new widgets their own headings, and keep distinct updates separate when they solve different user needs, even within the same existing widget.
- Credit all contributing authors in the heading: `(by @author1 and @author2)` or `(by @author1, @author2, and @author3)`
- Use `**bold label:**` for each bullet when a section has multiple items
- Performance and bug fix sections are separate from features

### Images

- Extract relevant screenshots or animations from PR bodies, including Markdown images and HTML image tags. Inspect them and prefer clear after-change examples that match the final release behavior.
- Place images beside the feature they demonstrate, with descriptive alt text. Use expandable details for additional examples when they would otherwise overwhelm the notes.
- Verify image URLs are accessible. Preserve GitHub attachments or commit-pinned repository URLs; do not use local paths or invent screenshots when a PR has none.
- Preserve relevant images already in the release when reviewing or updating its notes, including images added by the user after the first draft.

### Changelog ordering

Order the changelog entries by commit type, then by PR number within each group:

1. `feat:`: new features
2. `fix:`: bug fixes
3. `perf:`: performance improvements
4. `chore:`: maintenance, deps, tests, refactors (merge `refactor:` into `chore:` prefix)

### What to include / exclude

- Include all PRs in the range
- For PRs with empty descriptions, inspect the merged changes when needed and keep the entry brief; do not invent behavior from the title
- For dependabot PRs, just list them in the changelog; no feature/bugfix entry needed
- For documentation-only PRs (readme updates, storybook), just list in changelog
- Dev-only fixes (e.g. hot reload, dev refresh) go in Bug Fixes but note they're development-related

## Step 4: Review and verify

Before saving, check claims against the source PRs and previous release, ensure every PR appears once in the changelog with the correct author and link, retain verified contributor credits, and check that no em dashes remain. Confirm that follow-ups to newly introduced features are described only as part of their shipped behavior, and omit empty or user-excluded sections.

For a direct GitHub edit, re-read the release before writing to avoid overwriting intervening edits. Include its actual `tag_name` explicitly in the update; a body-only draft update can replace the intended version tag with the temporary `untagged-*` tag. After updating, fetch it again and verify that the saved body matches the intended notes (allowing line-ending normalization) and the release metadata and asset identities/content are unchanged. Draft release and asset download URLs can change when notes are edited; compare asset ids, names, sizes and digests, and return the release URL from this final read.

Tell the user where the notes were saved or link the edited release, briefly describe material corrections, and state whether the release remains a draft.
