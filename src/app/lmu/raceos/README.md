# raceos — LMU driver ratings

Fetches LMU driver ranks and badges, and merges them into the standings beside
the nationality and flag that `lmu/mapSession.ts` sets from the sim's own data.

## What is here

| File             | Role                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `client.ts`      | The auth exchange, the batched lookup, the cache and the backoff.  |
| `parse.ts`       | Reads the rating service's player records.                         |
| `httpsJson.ts`   | A `node:https` JSON transport, mirroring `lmu/rest/httpJson.ts`.   |
| `ticket.ts`      | Asks LMU for the Steam auth session ticket the exchange needs.     |
| `tapeRatings.ts` | The replay path: ratings read from a tape, with no network at all. |

`../../storage/driverRatings.ts` is the persistent cache, positive and
negative, that the client reads and writes.

## The credential chain

This is the part worth knowing before changing anything here. There is no API
key: the lookup is authorised by a credential the sim mints for the signed-in
user.

1. LMU's local REST API issues a Steam auth session ticket
   (`/rest/profile/getAuthSessionTicket`), as
   `{"authSessionTicket":"<hex>"}`.
2. `client.ts` exchanges it for an access token:

   ```http
   POST https://raceos.gg/authenticate
   Content-Type: application/json

   {"token":"<ticket>","game":"lmu","platform":"steam"}
   ```

   All three fields are required; without `game` the service answers
   `Invalid game specified`. The reply is
   `{"accessToken":"<jwt>","expiresAt":"<RFC 3339>"}` — an absolute instant,
   not a duration.

3. The token authorises a batched lookup of the **driver names** on the grid
   (~50 per call):

   ```http
   POST https://raceos.gg/api/v1/players
   Content-Type: application/json
   Game-Authorization: <jwt>

   {"usernames":["Herve Attard","Leonel Gomez"]}
   ```

   Note the header: `Game-Authorization`, and bare — no `Bearer ` prefix. The
   reply is a plain array of player records.

### Names, not Steam ids

The join is on driver name, which is not the obvious choice and was not the
first one tried. The sim reports `mSteamID` as **0 for every driver** — in
shared memory and in its own `/rest/watch/standings` — so there is no id to key
on, and the service takes usernames in any case.

Names are sent as the standings spell them: same capitalisation, UTF-8 intact,
and the `#1234` discriminator **kept**. That suffix is part of the username,
not noise — for `Sherry Dalton#6487` the service answers
`{"username":"Sherry Dalton#6487","name":"Sherry Dalton"}`, so the full string
identifies the player while the bare `name` is a display label several players
can share. Only surrounding whitespace is removed. `raceosUsername` in
`parse.ts` is that rule, applied to both sides of the join.

Answers are matched back on `username`, exactly first and then
case-insensitively: the service replies with its own stored spelling, which
need not be the one asked for. Getting this wrong is invisible — the service
has answered, so no failure path is taken — so the log reports what _matched_
rather than what came back, and warns when answers arrive that match nobody.

So the user's Steam identity is relayed to `raceos.gg`, a third party with no
public API, no published terms and no agreement with this project, and the
lookup covers every human on the grid rather than only the signed-in user.
Reading LMU's own loopback API is plainly fine — the user's sim on the user's
machine — and this is the one part of the LMU support that is not. It is a
deliberate choice, not an oversight: the endpoints and payload shapes were
recovered from LMUTraceHUB, which works the same way. If `raceos.gg` ever
offers a proper API key, steps 1 and 2 collapse into a configured secret and
most of the concern with them goes away.

Two consequences fall out of the chain and are not bugs:

- Ratings exist only while LMU is running and signed in through Steam. There
  is nothing to configure and nothing for the user to set up, and equally no
  way to make this work offline or outside a session.
- Nothing here is on a render path. Every lookup is best-effort: a failure
  leaves drivers unrated and the standings render exactly as they do without
  ratings, and a service that is down gets backed off rather than hammered.

## How it is wired

`bridge/iracingSdk/lmuSdkBridge.ts` owns the join. On each session poll it
hands `client.request()` the grid's Steam ids from `raw.drivers[].steamId`
(dropping the `"0"` that AI entries report), and passes `client.get` to
`mapLmuSession` as the synchronous lookup that fills `Driver.LmuRating`.
Answers arrive long after the snapshot that asked for them, so the client's
`onResolved` drops the bridge's session signature to force a republish.

The renderer needs no knowledge of any of this — it draws whatever ranks it
is given.

## Replays

A tape cannot resolve ratings the live way. The ticket is a live credential and
a tape is a fixture meant to be shared, so the recorder never captures that
path; a replay has nothing to authenticate with, and `createRaceosClient` is
not even built — `tapeRatings.ts` takes its place.

What makes badges work in a replay is that `anonymise` bakes them in. It writes
the ratings it finds in `lmu-driver-ratings.json` into the tape as one REST
record on a reserved path, keyed by driver name — and those keys go through the
same name substitution as every other recorded body, so on an anonymised tape
they come out as the pseudonyms the snapshots carry. No second mapping to keep
in step, and the replay shows the badges it was recorded with under the renamed
drivers.

`anonymise` also replaces every real `mSteamID` with a synthetic one. Nothing
reads that field any more, but a Steam id is a permanent, publicly resolvable
handle, and leaving it beside a pseudonymised name would defeat the pseudonym.

```
lmu_replay anonymise --input raw.lmudt --output anon.lmudt --names names.txt     [--ratings <cache.json>] [--no-ratings]
```

`--ratings` defaults to `%APPDATA%/irdashies/lmu-driver-ratings.json`. A missing
file, a grid the cache has nothing for, or `--no-ratings` all mean the same
thing: the replay shows flags but no badges. A remembered miss is left out
rather than baked, so a driver the service had nothing for stays that way.

The cache file is keyed by driver name and stores `version: 2`. A version 1
file was keyed by Steam id, so it holds nothing that could match a lookup
again and is discarded rather than migrated.

Two lists have to agree for any of this to work, and both are checked by
`rest/recorderParity.spec.ts` rather than by review: the recorder's REST paths
against `LMU_REST_TASKS`, and `kReplayRatingsPath` against
`REPLAY_RATINGS_PATH`.
