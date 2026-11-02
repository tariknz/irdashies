/**
 * Which kind of formation the radar is looking at: the rolling start, a
 * restart after a caution, or a standing grid. iRacing keeps a separate pole
 * side flag for the start and the restart, and a grid is its own thing, so a
 * player's correction is kept per situation too.
 */
export type PoleSituation = 'start' | 'restart' | 'grid';

export const POLE_SITUATIONS: readonly PoleSituation[] = [
  'start',
  'restart',
  'grid',
];

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
