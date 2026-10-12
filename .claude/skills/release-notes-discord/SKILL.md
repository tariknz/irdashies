---
name: release-notes-discord
description: Generate a condensed Discord post version of the release notes. Use after full release notes have been generated.
disable-model-invocation: true
---

# Discord Release Notes

Generate a condensed Discord-friendly version of the release notes. The user will provide the version (e.g. `v0.1.0`).

Read the version, comparison range, source notes, and output preferences from the user's request or conversation. In Claude Code, invocation arguments are also supplied as `$ARGUMENTS`; in Codex, use the text accompanying `$release-notes-discord`. Ask for any required input that is missing.

## Step 1: Find the full release notes

Use the full release notes supplied in the conversation or the identified GitHub release, or look at `~/Desktop/irdashies-demos/release-<version>.md`. If none are available, ask the user to generate full notes with the `release-notes` skill first (`/release-notes` in Claude Code or `$release-notes` in Codex).

## Step 2: Look up Discord handles

Use mappings supplied by the user or stored in private local memory to map GitHub usernames to Discord display names. Keep these mappings out of repository files and commits. Preserve explicitly approved GitHub-handle fallbacks. Ask for missing mappings before finalizing contributor credits.

## Step 3: Write the condensed post

Use a user-specified output path when provided; otherwise write to `~/Desktop/irdashies-demos/release-<version>-discord.md`. Resolve `~` to the current user's home directory and create the output directory if needed.

### Hard limit: 2000 characters

Check the character count with `wc -m` after writing. If over 2000, trim until it fits.

### Format

```
**irDashies <version>**

**New**
- Feature bullet points: short, one line each

**Fixes**
- Bug fix bullet points

**Performance**
- Performance improvement bullet points

**Tracks:** list
**Logos:** list

Welcome, <first-timers>!

Thanks to <contributors ordered by most PRs> for their contributions!

View the full release notes here:
https://github.com/tariknz/irdashies/releases/tag/<version>
```

### Rules

- **User-facing language:** no code, no function names, no technical jargon
- **Condense aggressively:** combine related items using short phrases. No em dashes; use colons, commas or separate sentences
- **Respect the previous release:** check that fixes, enhancements and performance claims affect capabilities users already had. Fold follow-ups to features or capabilities first shipping in this release into their introductions, including new capabilities within existing widgets. Apply the same rule to the full release notes; do not inherit misleading grouping from PR titles or commit prefixes
- **Preserve material limitations:** keep beta status, supported widget subsets and essential setup or caveats when condensing partial integrations
- **Order contributors by number of PRs** in the release, most first. Use Discord display names, not GitHub handles. Don't include yourself (tarik) in the thanks
- Check credited contributors beyond the generated "New Contributors" list, including work incorporated through someone else's PR. Verify prior contributions before placing them in returning thanks; do not describe an open PR as merged.
- **Always welcome first-time contributors:** pull the "New Contributors" list from the full release notes and call them out by Discord display name in a dedicated welcome line above the general thanks. Keep it warm and brief (one line). Don't repeat names: first-timers go in the welcome line only, and returning contributors go in the general thanks line only. If there are no first-timers, omit the welcome line and thank everyone in the general line. If everyone is a first-timer, the welcome line covers them and you can drop the general thanks line
- **Start with the most impactful features:** new widgets and major overhauls first, smaller enhancements after
- **Use available space for useful detail:** add back material benefits or caveats that were cut when space permits
- **Tracks and logos** get their own one-liner sections at the bottom when included. Omit sections the user excludes or that have no relevant updates
- **Always end with** the full release notes link
- **Skip dev-only fixes** (hot reload, branch refresh): Discord audience is end users

## Step 4: Verify and open

Check character count is under 2000, contributor placeholders are resolved, and excluded sections and em dashes are absent. Open in VS Code with `code <path>` when available; otherwise provide a link to the saved file.
