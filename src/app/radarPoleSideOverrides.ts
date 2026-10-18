import type { PoleSideSettings } from './processors/radarPoleSideSettings';

/** iRacing track id (as a string) -> pole line on the left. */
export type PoleSideOverrides = Record<string, boolean>;

/** The player can only correct so many tracks; a bigger file is not ours. */
const MAX_OVERRIDES = 10000;

export interface PoleSidePersistence {
  read(): unknown;
  write(overrides: PoleSideOverrides): void;
}

/** The stored file is untrusted: keep canonical ids with a boolean side. */
export const parsePoleSideOverrides = (raw: unknown): PoleSideOverrides => {
  const overrides: PoleSideOverrides = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return overrides;
  for (const [id, poleLeft] of Object.entries(raw).slice(0, MAX_OVERRIDES)) {
    if (/^[1-9]\d{0,9}$/.test(id) && typeof poleLeft === 'boolean') {
      overrides[id] = poleLeft;
    }
  }
  return overrides;
};

/**
 * The player's own pole side per track. Flipping the side the radar uses
 * stores the opposite of it; flipping back to what the table says removes the
 * entry, so only real differences are kept.
 */
export class RadarPoleSideOverrides implements PoleSideSettings {
  private overrides?: PoleSideOverrides;
  private track?: { trackId: number; tableLeft: boolean };

  constructor(private readonly persistence: PoleSidePersistence) {}

  private load(): PoleSideOverrides {
    this.overrides ??= parsePoleSideOverrides(this.persistence.read());
    return this.overrides;
  }

  override(trackId: number | undefined): boolean | undefined {
    if (trackId === undefined) return undefined;
    const overrides = this.load();
    const key = String(trackId);
    return Object.hasOwn(overrides, key) ? overrides[key] : undefined;
  }

  setTrack(trackId: number | undefined, tableLeft: boolean): void {
    this.track =
      trackId !== undefined && Number.isInteger(trackId) && trackId > 0
        ? { trackId, tableLeft }
        : undefined;
  }

  /**
   * Swaps the side in use on the current track. Returns the new side, or
   * undefined when no track is known yet.
   */
  flip(): { trackId: number; poleLeft: boolean } | undefined {
    if (!this.track) return undefined;
    const { trackId, tableLeft } = this.track;
    const key = String(trackId);
    const stored = this.load();
    const current = Object.hasOwn(stored, key) ? stored[key] : tableLeft;
    const poleLeft = !current;
    // Only a real difference from the table is kept.
    const overrides: PoleSideOverrides = Object.fromEntries(
      Object.entries(stored).filter(([id]) => id !== key)
    );
    if (poleLeft !== tableLeft) overrides[key] = poleLeft;
    this.persistence.write(overrides);
    this.overrides = overrides;
    return { trackId, poleLeft };
  }
}
