/**
 * What the radar needs to know about the player's own pole side choice. A
 * processor does no I/O, so this is injected; the app backs it with a file.
 */
export interface PoleSideSettings {
  /** The side the player set for this track (true: left), if they did. */
  override(trackId: number | undefined): boolean | undefined;
  /** The radar reports the track it is on and the side the table gives. */
  setTrack(trackId: number | undefined, tableLeft: boolean): void;
}

export const NO_POLE_SIDE_SETTINGS: PoleSideSettings = {
  override: () => undefined,
  setTrack: () => undefined,
};
