/**
 * Session types a profile can be bound to, so the app can switch layouts as an
 * event moves from practice through qualifying to the race.
 *
 * This deliberately mirrors the vocabulary of `SessionVisibilitySettings`
 * rather than reusing it: widget visibility has no Warmup key, and adding one
 * there would change the settings shape of every widget that has visibility
 * options.
 */
export type SessionProfileKey =
  | 'practice'
  | 'timeTrial'
  | 'openQualify'
  | 'loneQualify'
  | 'warmup'
  | 'race'
  | 'offlineTesting';

export const SESSION_PROFILE_KEYS: SessionProfileKey[] = [
  'practice',
  'timeTrial',
  'openQualify',
  'loneQualify',
  'warmup',
  'race',
  'offlineTesting',
];

/** Display labels for the settings UI, in the order sessions normally run. */
export const SESSION_PROFILE_LABELS: Record<SessionProfileKey, string> = {
  practice: 'Practice',
  timeTrial: 'Time Trial',
  openQualify: 'Open Qualifying',
  loneQualify: 'Lone Qualifying',
  warmup: 'Warmup',
  race: 'Race',
  offlineTesting: 'Offline Testing',
};

/**
 * `spotting` is not a session type — it is a state that can occur inside any
 * of them, when the player is in the session but not in the car. It takes
 * precedence over the session type while it lasts, and hands back as soon as
 * the player is driving again.
 */
export type ProfileTriggerKey = SessionProfileKey | 'spotting';

export const SPOTTING_TRIGGER_KEY = 'spotting' as const;

export const SPOTTING_TRIGGER_LABEL = 'Spotting / watching';

/**
 * Maps a profile id to each trigger. A key that is absent, or set to an empty
 * string, means "leave the profile alone" — which is what every key means
 * until the user configures one.
 */
export type SessionProfileMap = Partial<Record<ProfileTriggerKey, string>>;

/**
 * iRacing reports session types as display strings in `SessionInfo.Sessions[]`.
 * Only exact known values map; anything unrecognised yields undefined and is
 * treated as "no opinion", so an unfamiliar session never yanks the user onto
 * a different layout.
 *
 * These are every distinct value seen across 205 recorded sessions: Practice,
 * Race, Lone Qualify, Offline Testing, Open Qualify, Warmup and Lone Practice.
 * Two are worth knowing about:
 *
 * - A Time Trial reports as 'Lone Practice' (with SessionName 'TIME TRIAL'),
 *   which is why the Time Trial trigger keys off that string.
 * - Heat events run several sessions that all report 'Race', separated only by
 *   SessionSubType (Heat / Consolation / Feature). They therefore share one
 *   profile, and moving between heats does not re-trigger a switch.
 */
const SESSION_TYPE_TO_KEY: Record<string, SessionProfileKey> = {
  Practice: 'practice',
  // A Time Trial reports as 'Lone Practice' with SessionName 'TIME TRIAL'.
  // It gets its own trigger because it is a solo hot-lap session, closer in
  // use to qualifying than to open practice.
  'Lone Practice': 'timeTrial',
  'Open Qualify': 'openQualify',
  'Lone Qualify': 'loneQualify',
  Warmup: 'warmup',
  Race: 'race',
  'Offline Testing': 'offlineTesting',
};

export const sessionProfileKeyFor = (
  sessionType: string | undefined | null
): SessionProfileKey | undefined => {
  if (!sessionType) return undefined;
  return SESSION_TYPE_TO_KEY[sessionType.trim()];
};
