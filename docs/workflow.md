```mermaid
graph TD
    subgraph discord["Discord"]
        report["Report ticket"]
        check["Check ticket status"]
        review["Review ticket"]
        track["Track ticket"]
        reject["Reject ticket"]
        close["Close ticket"]
    end

    subgraph github["GitHub"]
        createIssue["Create issue"]
        push["Push bugfix/feature"]
    end

    user["👤 User"]
    dev["👨‍💻 Dev"]

    user -->|does| report
    user -->|does| check

    dev -->|does| review
    dev -->|does| push

    report -->|note: This can be a<br/>bug report or feature request| report
    track -->|note: Link<br/>github issue| track
    reject -->|note: Explain why<br/>ticket is rejected| reject

    reject -->|extends| review
    track -->|extends| review
    track -->|includes| createIssue
    close -->|extends| push

    style discord fill:#e1f5ff,stroke:#0288d1
    style github fill:#f3e5f5,stroke:#7b1fa2
    style user fill:#fff3e0,stroke:#f57f17
    style dev fill:#fff3e0,stroke:#f57f17
```

## GitHub notifications in Discord

`.github/workflows/discord-pr-notifications.yml` posts to `#github-logs` when a
pull request is opened or merged. Each card links to the PR and includes its
number, title, author, repository, and target branch. Merged cards also show who
merged it. Opened cards are green; merged cards are purple. Draft PRs and bot
authors are included. Edits, commits, reopens, and unmerged closures are ignored.
Notifications do not ping Discord users or roles.

Configure the repository Actions secret `DISCORD_GITHUB_LOGS_WEBHOOK_URL` with
the Discord webhook URL for `#github-logs` (Channel Settings → Integrations →
Webhooks). Use the standard webhook URL, without the `/github` suffix. Keep the
URL secret: it permits posting to the channel.

The workflow becomes active after it is merged into the default branch and
applies to subsequent events; it does not backfill existing PRs. It uses
`pull_request_target` to support contributors from forks and runs only the
trusted inline notification script. It does not check out or execute PR code,
and the GitHub token has no permissions. PR content is read from the event JSON
and encoded as JSON, never interpolated into executable code.

The existing GitHub-compatible webhook handles forks, releases, and stars
separately. Leave PR events disabled on that webhook to avoid duplicate PR
notifications. To silence forks or stars, deselect those events in the
repository's Settings → Webhooks.
