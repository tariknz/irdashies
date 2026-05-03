import { useEffect, useState } from 'react';
import type { ChromiumFlagsType } from '@irdashies/types';
import { DEFAULT_CHROMIUM_FLAGS } from '@irdashies/types';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingsSection } from '../components/SettingSection';
import logger from '@irdashies/utils/logger';

const ANGLE_OPTIONS: {
  label: string;
  value: NonNullable<ChromiumFlagsType['angleBackend']>;
}[] = [
  { label: 'Default (Chromium chooses)', value: 'default' },
  { label: 'OpenGL (gl)', value: 'gl' },
  { label: 'Direct3D 11 (d3d11)', value: 'd3d11' },
  { label: 'Direct3D 9 (d3d9)', value: 'd3d9' },
  { label: 'Vulkan', value: 'vulkan' },
  { label: 'Metal (macOS)', value: 'metal' },
];

const PLACEHOLDER = `# One switch per line, no leading "--"
# Examples:
# disable-gpu-vsync
# force-color-profile=srgb`;

export const ChromiumFlagsSettings = () => {
  const [flags, setFlags] = useState<ChromiumFlagsType | null>(() => {
    if (!window.chromiumFlagsBridge) {
      logger.warn('chromiumFlagsBridge unavailable; using defaults');
      return { ...DEFAULT_CHROMIUM_FLAGS };
    }
    return null;
  });

  useEffect(() => {
    if (!window.chromiumFlagsBridge) return;

    window.chromiumFlagsBridge
      .getFlags()
      .then((loaded) => setFlags({ ...DEFAULT_CHROMIUM_FLAGS, ...loaded }))
      .catch((err) => {
        logger.error('Failed to load chromium flags', err);
        setFlags({ ...DEFAULT_CHROMIUM_FLAGS });
      });
  }, []);

  if (!flags) {
    return <div className="px-4 text-sm text-slate-400">Loading...</div>;
  }

  const persist = (next: ChromiumFlagsType) => {
    setFlags(next);
    window.chromiumFlagsBridge?.saveFlags(next).catch((err) => {
      logger.error('Failed to save chromium flags', err);
    });
  };

  const update = <K extends keyof ChromiumFlagsType>(
    key: K,
    value: ChromiumFlagsType[K]
  ) => {
    persist({ ...flags, [key]: value });
  };

  const featuresToList = (text: string): string[] =>
    text
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 space-y-6">
        <p className="text-sm text-slate-400 px-4">
          Override Chromium command-line switches. Use these only if you
          experience rendering glitches like black flickering on transparent
          overlays. These settings are stored locally per machine (separate from
          dashboard.json) and require an app restart to take effect.
        </p>

        <SettingsSection title="Recommended fixes">
          <SettingToggleRow
            title="Disable native window occlusion"
            description="Prevents Chromium from blanking the overlay when it incorrectly thinks the window is hidden. Most common fix for black flickering on NVIDIA GPUs (sets --disable-features=CalculateNativeWinOcclusion)."
            enabled={flags.disableNativeWinOcclusion ?? false}
            onToggle={(v) => update('disableNativeWinOcclusion', v)}
          />

          <SettingSelectRow
            title="ANGLE graphics backend"
            description="Forces Chromium's graphics backend. Switching to OpenGL often resolves NVIDIA RTX-series transparency bugs at a small performance cost (sets --use-angle)."
            value={flags.angleBackend ?? 'default'}
            options={ANGLE_OPTIONS}
            onChange={(v) => update('angleBackend', v)}
          />

          <SettingToggleRow
            title="Disable Direct Composition"
            description="Disables Windows DirectComposition for transparent windows. Heavier fallback than the occlusion fix while still keeping GPU rendering enabled (sets --disable-direct-composition)."
            enabled={flags.disableDirectComposition ?? false}
            onToggle={(v) => update('disableDirectComposition', v)}
          />
        </SettingsSection>

        <SettingsSection title="Additional features">
          <div className="space-y-2">
            <h4 className="text-md font-medium text-slate-300">
              Disable features
            </h4>
            <p className="text-sm text-slate-500">
              Comma- or space-separated feature names appended to{' '}
              <code className="text-slate-400">--disable-features</code>.
            </p>
            <textarea
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 font-mono text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[3rem]"
              rows={2}
              value={(flags.disableFeatures ?? []).join(', ')}
              onChange={(e) =>
                update('disableFeatures', featuresToList(e.target.value))
              }
              placeholder="e.g. HardwareMediaKeyHandling, WidgetLayering"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-md font-medium text-slate-300">
              Enable features
            </h4>
            <p className="text-sm text-slate-500">
              Comma- or space-separated feature names appended to{' '}
              <code className="text-slate-400">--enable-features</code>.
            </p>
            <textarea
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 font-mono text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[3rem]"
              rows={2}
              value={(flags.enableFeatures ?? []).join(', ')}
              onChange={(e) =>
                update('enableFeatures', featuresToList(e.target.value))
              }
              placeholder="e.g. CanvasOopRasterization"
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Custom switches">
          <p className="text-sm text-slate-500">
            Freeform Chromium switches, one per line. Format:{' '}
            <code className="text-slate-400">switch-name</code> or{' '}
            <code className="text-slate-400">switch-name=value</code> (no
            leading <code className="text-slate-400">--</code>). Lines starting
            with <code className="text-slate-400">#</code> are ignored.
          </p>
          <textarea
            className="w-full bg-slate-800 border border-slate-600 rounded p-2 font-mono text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[8rem]"
            rows={6}
            value={flags.customSwitches ?? ''}
            onChange={(e) => update('customSwitches', e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
          />
        </SettingsSection>

        <div className="px-4">
          <button
            type="button"
            onClick={() => persist({ ...DEFAULT_CHROMIUM_FLAGS })}
            className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Reset all Chromium flags
          </button>
        </div>
      </div>
    </div>
  );
};
