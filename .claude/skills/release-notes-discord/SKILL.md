---
name: release-notes-discord
description: Generate a condensed Discord post version of the release notes. Use after full release notes have been generated.
disable-model-invocation: true
---

# Discord Release Notes

Generate a condensed Discord-friendly version of the release notes. The user will provide the version (e.g. `v0.1.0`).

Arguments: $ARGUMENTS

## Step 1: Find the full release notes

Look for the full release notes at `/Users/tarik/Desktop/irdashies-demos/release-<version>.md`. If they don't exist, tell the user to run `/release-notes` first.

## Step 2: Look up Discord handles

Check the memory file at `/Users/tarik/.claude/projects/-Users-tarik-projects-irdashies/memory/reference_discord_handles.md` to map GitHub usernames to Discord display names. If any contributors are missing from the mapping, ask the user for their Discord handles before proceeding.

## Step 3: Write the condensed post

Write to `/Users/tarik/Desktop/irdashies-demos/release-<version>-discord.md`.

### Hard limit: 2000 characters

Check the character count with `wc -m` after writing. If over 2000, trim until it fits.

### Format

```
**iRDashies <version>**

**New**
- Feature bullet points — short, one line each

**Fixes**
- Bug fix bullet points

**Performance**
- Performance improvement bullet points

**Tracks:** list
**Logos:** list

Thanks to <contributors ordered by most PRs> for their contributions!

View the full release notes here:
https://github.com/tariknz/irdashies/releases/tag/<version>
```

### Rules

- **User-facing language** — no code, no function names, no technical jargon
- **Condense aggressively** — combine related items, use short phrases with em-dashes
- **Order contributors by number of PRs** in the release, most first. Use Discord display names, not GitHub handles. Don't include yourself (tarik) in the thanks
- **Start with the most impactful features** — new widgets and major overhauls first, smaller enhancements after
- **Use all available space** — if you're well under 2000 characters, add back detail that was cut. Don't leave room on the table unnecessarily
- **Tracks and logos** get their own one-liner sections at the bottom
- **Always end with** the full release notes link
- **Skip dev-only fixes** (hot reload, branch refresh) — Discord audience is end users

## Step 4: Verify and open

Check character count is under 2000, then open in VS Code with `code <path>`.
