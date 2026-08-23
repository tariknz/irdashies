/** Class positions either side of the player that auto-pin includes. */
export const AUTO_PIN_NEIGHBOURS = 3;

export interface AutoPinDriver {
  carIdx: number;
  /** In-class position. 0 or undefined when not yet known. */
  classPosition?: number;
  isPlayer: boolean;
}

/**
 * The cars worth drawing at full strength before the user picks their own:
 * the player, the class leader, and the cars within `neighbours` positions of
 * the player. Returns carIdxs sorted, so an unchanged set compares equal.
 */
export const autoPinCarIdxs = (
  drivers: readonly AutoPinDriver[],
  leaderCarIdx: number | null,
  neighbours = AUTO_PIN_NEIGHBOURS
): number[] => {
  const chosen = new Set<number>();
  if (leaderCarIdx !== null) chosen.add(leaderCarIdx);

  const player = drivers.find((driver) => driver.isPlayer);
  if (player) chosen.add(player.carIdx);

  const playerPosition = player?.classPosition ?? 0;
  if (playerPosition > 0) {
    for (const driver of drivers) {
      const position = driver.classPosition ?? 0;
      if (position > 0 && Math.abs(position - playerPosition) <= neighbours) {
        chosen.add(driver.carIdx);
      }
    }
  }

  return [...chosen].sort((a, b) => a - b);
};
