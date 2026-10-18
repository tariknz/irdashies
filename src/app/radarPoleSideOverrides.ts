import type {
  PoleSideSettings,
  PoleSituation,
} from './processors/radarPoleSideSettings';

/**
 * One track's corrections: the side (true: left) the player chose for a race
 * start and for a restart, and the side the table gave when they chose it.
 */
export interface PoleSideCorrection {
  start?: boolean;
  restart?: boolean;
  table: boolean;
}

/** iRacing track id (as a string) -> the player's corrections there. */
export type PoleSideOverrides = Record<string, PoleSideCorrection>;

/** The player can only correct so many tracks; a bigger file is not ours. */
const MAX_OVERRIDES = 10000;

export interface PoleSidePersistence {
  read(): unknown;
  write(overrides: PoleSideOverrides): void;
}

/** The stored file is untrusted: keep canonical ids with well formed sides. */
export const parsePoleSideOverrides = (raw: unknown): PoleSideOverrides => {
  const overrides: PoleSideOverrides = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return overrides;
  for (const [id, entry] of Object.entries(raw).slice(0, MAX_OVERRIDES)) {
    const value = entry as Partial<Record<keyof PoleSideCorrection, unknown>>;
    if (
      !/^[1-9]\d{0,9}$/.test(id) ||
      !value ||
      typeof value !== 'object' ||
      typeof value.table !== 'boolean'
    ) {
      continue;
    }
    const correction: PoleSideCorrection = { table: value.table };
    if (typeof value.start === 'boolean') correction.start = value.start;
    if (typeof value.restart === 'boolean') correction.restart = value.restart;
    if (correction.start !== undefined || correction.restart !== undefined) {
      overrides[id] = correction;
    }
  }
  return overrides;
};

/**
 * The player's own pole side per track and situation. Flipping the side the
 * radar uses stores the opposite of it; flipping back to what the table says
 * removes it, so only real differences are kept.
 */
export class RadarPoleSideOverrides implements PoleSideSettings {
  private overrides?: PoleSideOverrides;
  private track?: {
    trackId: number;
    tableLeft: boolean;
    situation: PoleSituation;
  };

  private readonly listeners = new Set<() => void>();

  constructor(private readonly persistence: PoleSidePersistence) {}

  /** Called after a flip was saved; returns the way to stop listening. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private load(): PoleSideOverrides {
    this.overrides ??= parsePoleSideOverrides(this.persistence.read());
    return this.overrides;
  }

  override(
    trackId: number | undefined,
    situation: PoleSituation
  ): boolean | undefined {
    if (trackId === undefined) return undefined;
    const overrides = this.load();
    const key = String(trackId);
    return Object.hasOwn(overrides, key)
      ? overrides[key][situation]
      : undefined;
  }

  setTrack(
    trackId: number | undefined,
    tableLeft: boolean,
    situation: PoleSituation
  ): void {
    this.track =
      trackId !== undefined && Number.isInteger(trackId) && trackId > 0
        ? { trackId, tableLeft, situation }
        : undefined;
  }

  /** What the player has corrected so far, for the analytics report. */
  snapshot(): PoleSideOverrides {
    return structuredClone(this.load());
  }

  /**
   * Swaps the side in use on the current track and situation. Returns the new
   * side, or undefined when no track is known yet.
   */
  flip():
    | { trackId: number; situation: PoleSituation; poleLeft: boolean }
    | undefined {
    if (!this.track) return undefined;
    const { trackId, tableLeft, situation } = this.track;
    const key = String(trackId);
    const stored = this.load();
    const current = this.override(trackId, situation) ?? tableLeft;
    const poleLeft = !current;
    // Only a real difference from the table is kept.
    const before = Object.hasOwn(stored, key) ? stored[key] : undefined;
    const sideOf = (which: PoleSituation) =>
      which === situation
        ? poleLeft === tableLeft
          ? undefined
          : poleLeft
        : before?.[which];
    const start = sideOf('start');
    const restart = sideOf('restart');
    const overrides: PoleSideOverrides = Object.fromEntries(
      Object.entries(stored).filter(([id]) => id !== key)
    );
    if (start !== undefined || restart !== undefined) {
      overrides[key] = {
        ...(start !== undefined && { start }),
        ...(restart !== undefined && { restart }),
        table: tableLeft,
      };
    }
    this.persistence.write(overrides);
    this.overrides = overrides;
    this.listeners.forEach((listener) => listener());
    return { trackId, situation, poleLeft };
  }
}
