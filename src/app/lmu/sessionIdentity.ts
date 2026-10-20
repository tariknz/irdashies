import { fnv1a32 } from './hash';

/**
 * A session id LMU does not provide.
 *
 * `mScoringInfo.mSession` is the session *type* -- 1 for practice, and so on
 * -- not an identifier. The mappers published it as both `SubSessionID` and
 * `SessionUniqueID`, so every practice session LMU has ever run reported the
 * same id, and two different sessions were indistinguishable.
 *
 * That broke session-change detection outright. Everything that decides a
 * session has changed by comparing ids -- race control, lap history, the
 * reference lap, the replay context, the standings processor's results
 * snapshot -- compared 1 against 1 and kept its state. Changing track left the
 * standings showing the grid from the track before, because as far as those
 * consumers were concerned nothing had happened. The renderer's lap tracer was
 * the exception, and only because it keys on the track id instead.
 *
 * Derived from track, session type and server, which is as close to identity
 * as LMU exposes:
 *
 * - **track** so a track change is a new session, which is the case that
 *   showed the bug;
 * - **type** so practice, qualifying and the race are each their own;
 * - **server** so two servers running the same event do not share stored lap
 *   history.
 *
 * Deliberately stable rather than unique per join: reconnecting to the same
 * event is the same session, and should find its history where it left it.
 * That is also why the clock is not in it.
 */

/** Just enough of either raw shape; both come from the addon's `read`. */
interface LmuSessionIdentitySource {
  trackName?: string;
  session?: number;
  serverName?: string;
}

/** Separates the parts, so neighbouring values cannot run together. */
const SEP = '\u0001';

export const lmuSessionUniqueId = (raw: LmuSessionIdentitySource): number => {
  const id = fnv1a32(
    `${raw.trackName ?? ''}${SEP}${raw.session ?? -1}${SEP}${raw.serverName ?? ''}`
  );
  // 0 is reserved: ReplayContextProcessor reads it as "no session named", the
  // convention iRacing's offline sessions set. A hash landing there is
  // vanishingly unlikely and would be baffling, so it is spent here.
  return id === 0 ? 1 : id;
};
