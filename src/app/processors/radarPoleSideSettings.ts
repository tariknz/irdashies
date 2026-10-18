/**
 * Which kind of pace field the radar is looking at: the race start, or a
 * restart after a caution. iRacing keeps a separate pole side flag for each,
 * so a player's correction is kept per situation too.
 */
export type PoleSituation = 'start' | 'restart';

/**
 * What the radar needs to know about the player's own pole side choice. A
 * processor does no I/O, so this is injected; the app backs it with a file.
 */
export interface PoleSideSettings {
  /** The side the player set for this track and situation (true: left). */
  override(
    trackId: number | undefined,
    situation: PoleSituation
  ): boolean | undefined;
  /**
   * The radar reports the track and situation it is on, and the side the
   * table gives, whenever either changes.
   */
  setTrack(
    trackId: number | undefined,
    tableLeft: boolean,
    situation: PoleSituation
  ): void;
}

export const NO_POLE_SIDE_SETTINGS: PoleSideSettings = {
  override: () => undefined,
  setTrack: () => undefined,
};
