---
name: babysit-pr
description: Monitor an existing GitHub pull request through CI and review, fix valid findings, and reply to review comments. Use when the user asks to watch, monitor, or babysit a PR, or handle its review comments. Publishing alone does not trigger this workflow; merge only when explicitly requested.
---

# Babysit a Pull Request

Bring the PR to a verified handoff by handling CI failures and review feedback
within the user's requested scope. A babysitting request includes making,
validating, committing, and pushing relevant fixes, replying on the user's behalf,
and resolving addressed bot threads. If the user requests observation only,
report findings without changing code, posting replies, or resolving threads.

## Start or Resume

- Read `AGENTS.md` and the architecture rules relevant to any fixes. Confirm the
  target PR, repository, head branch, and base branch. Inspect local changes and
  preserve unrelated user work; never commit directly to `main`.
- Read the live PR state, latest head SHA, checks, review submissions, top-level
  comments, and inline review threads, including resolved state. Fetch all pages.
  Comments alone do not show whether a thread is resolved or approval is pending.
- Inspect existing unresolved feedback before starting a watcher. Reassess older
  comments against the current code rather than filtering by the latest push time.
- On resume, use GitHub's current state and existing replies to recover progress.
  Track comment/thread IDs, reply URLs, and the head assessed to avoid duplicate
  replies or repeated fixes. A new head requires reassessing affected findings.
- In T3 Code, link the PR with `link_pull_request` immediately after taking it over
  or pushing to it, following the host's linking rules.

## Handle Findings

1. Verify each actionable finding against the current source and repository rules.
   Read any cited review configuration. Treat bot findings as claims to investigate.
2. Fix real bugs and CI failures within the intended PR scope. Avoid unrelated
   refactors or speculative compatibility work. Explain declined suggestions with
   evidence; report useful out-of-scope work as follow-ups without creating issues
   unless requested. Escalate decisions that materially change the user's goal.
3. Inspect failing-check logs and distinguish code failures from infrastructure
   failures. Retry only when there is evidence of a transient failure; report
   persistent infrastructure blockers rather than repeatedly rerunning checks.
4. Run checks appropriate to each fix, commit, and push to the PR's branch. Keep
   validation claims accurate, including the distinction between automated,
   Storybook, and actual iRacing testing. Refresh the live head and checks after
   pushing; checks or reviews for an earlier commit do not prove the new head.
5. Reply in the original thread with the fixing commit and relevant validation, or
   a concrete reason the finding does not apply. Lead with the conclusion, cite
   code or observed behavior, and distinguish verified facts from judgment. Avoid
   filler, repetitive status comments, and unsupported claims of success.
6. Check replies, quoted text, and attachments for private details before posting.
   Verify the returned reply URL before resolving a thread. After a failed or
   ambiguous post, read existing replies before retrying to avoid duplicates.
7. Resolve bot threads only after the fix is pushed and the reply succeeds, or an
   evidence-backed explanation has been posted for a declined finding. Leave human
   threads open for the reviewer unless the user explicitly asks to resolve them.
   Do not dismiss human reviews or treat a reply as satisfying required approval.

## Wait for Events

Use one supported watcher per PR. Do not build a polling script or use sleep
loops, `gh --watch`, or repeated status calls to wait.

In T3 Code:

- Only the thread owning the PR starts a watch; delegated reviewers never do.
- Handle existing checks and feedback, finish needed fixes and pushes, then call
  `watch_pull_request` and end the turn. Only subsequent events trigger a wake.
- The watch persists across wakes. On each wake, read current PR state, handle
  actionable changes, and assess readiness again. Do not restart an active watch
  or infer readiness solely from the wake message.
- While checks or automated reviews remain pending, keep the watch active and end
  the turn. Avoid repeated messages when an event needs no action.
- Call `unwatch_pull_request` before a final handoff, blocker report, or question
  requiring user input. A merged or closed PR ends monitoring.

Outside T3 Code, use an existing supported watcher if available and follow its
resume/stop behavior. If none is available, perform a current-state review and
report that ongoing monitoring could not be started. Do not claim to be watching.
On rate-limit or authentication failures, report the blocker without retry loops.

## Readiness and Handoff

Before declaring readiness, fetch the base branch and reread the live PR. Confirm:

- The PR is open and ready for review. Preserve an explicitly requested draft and
  report it as a draft rather than ready to merge.
- Required checks pass for the latest head. Configured automated reviews that
  apply to this PR have completed for that head; do not wait for absent bots.
- Actionable findings are addressed or declined with written evidence. Pending
  human approval, unresolved human threads, or requests for changes are identified.
- GitHub reports the PR as mergeable, and the branch meets the repository's base
  freshness requirements. Inspect new base commits that overlap the PR's files;
  update and validate the branch when needed before declaring it ready.

Stop when ready, when only human review remains, when a decision or external
blocker prevents progress, or when the PR is merged or closed. Unwatch before
handing back. Report the PR URL, final head SHA, validation performed, feedback
addressed, and any remaining approvals or blockers. Distinguish ready to merge
from waiting for human review or blocked.

Leave the PR open and unmerged by default. Merge, enable auto-merge, or enter a
merge queue only when the user explicitly requests it. Do not close the PR or
bypass branch protection as part of babysitting.
