/**
 * Chromium / GPU command-line switches applied at app startup.
 * Stored separately from the dashboard config because these are
 * machine-specific (driver / GPU dependent) and should not travel
 * with dashboard import/export.
 */
export interface ChromiumFlagsType {
  /**
   * Disables Chromium's native window occlusion detection. Common fix for
   * black flickering on transparent always-on-top overlays — Chromium will
   * sometimes wrongly detect the overlay as occluded and stop painting it.
   */
  disableNativeWinOcclusion?: boolean;
  /**
   * Forces the ANGLE graphics backend. 'default' lets Chromium choose
   * (typically d3d11 on Windows). Switching to 'gl' often resolves NVIDIA
   * RTX-series transparency bugs at a small performance cost.
   */
  angleBackend?: 'default' | 'gl' | 'd3d11' | 'd3d9' | 'metal' | 'vulkan';
  /**
   * Disables Windows DirectComposition for transparent windows. Heavier
   * fallback than the occlusion fix while keeping GPU rendering enabled.
   */
  disableDirectComposition?: boolean;
  /** Extra feature names appended to --disable-features (one per entry). */
  disableFeatures?: string[];
  /** Extra feature names appended to --enable-features (one per entry). */
  enableFeatures?: string[];
  /**
   * Freeform additional switches, one per line. Each line is either
   * `switch-name` or `switch-name=value` (no leading `--`).
   */
  customSwitches?: string;
}

export const DEFAULT_CHROMIUM_FLAGS: ChromiumFlagsType = {
  disableNativeWinOcclusion: false,
  angleBackend: 'default',
  disableDirectComposition: false,
  disableFeatures: [],
  enableFeatures: [],
  customSwitches: '',
};

/** Bridge methods exposed to the renderer for chromium flag management */
export interface ChromiumFlagsBridge {
  getFlags: () => Promise<ChromiumFlagsType>;
  saveFlags: (flags: ChromiumFlagsType) => Promise<ChromiumFlagsType>;
}
