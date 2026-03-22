---
name: release-notes
description: Generate user-facing release notes for a version by reading PR descriptions from GitHub. Use when the user asks to create or draft release notes.
disable-model-invocation: true
---

# Release Notes Generator

Generate release notes for the given version tag or range. The user will provide the version (e.g. `v0.1.0`) or a comparison range (e.g. `v0.0.41...v0.1.0`).

Arguments: $ARGUMENTS

## Step 1: Get the PR list

Use `gh` to get all merged PRs in the release range. If the user provides a single version tag, find the previous tag to build the comparison range.

```bash
# Find the previous tag if needed
git tag --sort=-v:refname

# Get the commit range
git log <previous-tag>...<version-tag> --oneline

# Extract PR numbers from merge commits or commit messages
```

## Step 2: Fetch every PR description

For each PR, fetch the title, body, and author using `gh`:

```bash
gh pr view <number> --json title,body,author
```

**This is critical** — do NOT write release notes from PR titles alone. You MUST read the full PR description body to understand what each change actually does.

## Step 3: Write the release notes

Write the notes to `/Users/tarik/Desktop/irdashies-demos/release-<version>.md`.

### Tone and audience

- **User-facing** — write for iRacing sim racers who use the app, not developers
- **No technical jargon** — no code references, function names, variable names, file paths, algorithm descriptions, hook names, or internal architecture details
- **Describe what changed for the user** — what they'll see, what they can now do, what's fixed from their perspective
- **Keep it concise** — one clear sentence per bullet point where possible

### Document structure

```markdown
## Features

### Feature Name (by @author)

Brief description of the feature.

- Bullet points describing what users can do

### ...more features...

### Performance Optimizations (by @author)

- Bullet points — describe the user-visible improvement (e.g. "smoother rendering"), not the implementation

### Bug Fixes

- **Short label** — one-line description of what was broken and what's fixed now (by @author)

### Changelog

- commit-prefix: title by @author in PR-URL
- ...

### New Contributors

- @user made their first contribution in PR-URL

**Full Changelog**: compare-URL
```

### Grouping rules for the Features section

- Group related PRs together under a single heading (e.g. multiple standings fixes/features become "Standings Enhancements")
- Credit all contributing authors in the heading: `(by @author1 and @author2)` or `(by @author1, @author2, and @author3)`
- Use `**bold label**` with em-dash for each bullet when a section has multiple items
- Performance and bug fix sections are separate from features

### Changelog ordering

Order the changelog entries by commit type, then by PR number within each group:

1. `feat:` — new features
2. `fix:` — bug fixes
3. `perf:` — performance improvements
4. `chore:` — maintenance, deps, tests, refactors (merge `refactor:` into `chore:` prefix)

### What to include / exclude

- Include all PRs in the range
- For PRs with empty descriptions, use the title and your best judgement but keep it brief
- For dependabot PRs, just list them in the changelog — no feature/bugfix entry needed
- For documentation-only PRs (readme updates, storybook), just list in changelog
- Dev-only fixes (e.g. hot reload, dev refresh) go in Bug Fixes but note they're development-related

## Step 4: Show the user

After writing the file, let the user know it's ready and give a brief summary of what's in the release.
