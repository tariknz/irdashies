# raceos — LMU driver ratings (incomplete)

**Nothing in this folder is wired up.** It is the groundwork for fetching LMU
driver ranks and badges, and it is deliberately inert pending a decision
described below. The parts of the feature that do ship — driver nationality,
the flag, and the rank badge component — do not depend on anything here.

## What is here

| File           | State                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| `parse.ts`     | Done and tested. Reads the rating service's player records.                        |
| `httpsJson.ts` | Done. A `node:https` JSON transport, mirroring `lmu/rest/httpJson.ts`.             |
| _(client)_     | **Not written.** The piece that performs the auth exchange and the batched lookup. |

`../../storage/driverRatings.ts` is the persistent cache the client would use.
It is done and tested, and is also unreferenced until the client exists.

## Why it stopped

The lookup only works by taking a Steam auth session ticket that LMU issues
for the signed-in user (`/rest/profile/getAuthSessionTicket`) and presenting
it to a third party, `raceos.gg`, to obtain a bearer token.

That is how LMUTraceHUB does it, and the endpoints and payload shapes here
were recovered from that binary. But it means this app would be:

- authenticating to a service that has no public API, no published terms, and
  no agreement with this project;
- relaying a credential the sim minted for a different purpose;
- doing so for every driver on the grid, not just the signed-in user.

Reading LMU's own loopback API is plainly fine — it is the user's sim on the
user's machine. Forwarding the user's Steam identity to an unaffiliated
service is a different question, and it is the project owner's to answer, not
something to slip in behind a feature flag.

## To finish it

Two things are needed, in order:

1. **A decision**, ideally with `raceos.gg` asked directly whether third-party
   clients may use the API and on what terms. If they offer a proper API key,
   the Steam-ticket relay disappears and most of the concern with it.
2. **The client**, which would own: ticket → token exchange with expiry,
   batched lookup (~50 Steam IDs per call), the positive/negative cache in
   `driverRatings.ts`, and exponential backoff on failure. Roughly 180 lines.

Once it exists, the only other change is in `lmuSdkBridge.ts`: collect the
grid's Steam IDs from `raw.drivers[].steamId`, hand them to the client, and
merge its answers into `Driver.LmuRating` beside the nationality that
`mapSession.ts` already sets. The renderer needs no further change — it
already draws whatever ranks it is given.
