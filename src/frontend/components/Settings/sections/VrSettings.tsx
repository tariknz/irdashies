import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  DEFAULT_VR_OVERLAY_SETTINGS,
  type GeneralSettingsType,
  type VrOverlaySettings,
} from '@irdashies/types';
import { SettingNumberRow } from '../components/SettingNumberRow';

export const VrSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const [settings, setSettings] = useState<Required<VrOverlaySettings>>({
    width:
      currentDashboard?.generalSettings?.vr?.width ??
      DEFAULT_VR_OVERLAY_SETTINGS.width,
    distance:
      currentDashboard?.generalSettings?.vr?.distance ??
      DEFAULT_VR_OVERLAY_SETTINGS.distance,
    horizontal:
      currentDashboard?.generalSettings?.vr?.horizontal ??
      DEFAULT_VR_OVERLAY_SETTINGS.horizontal,
    vertical:
      currentDashboard?.generalSettings?.vr?.vertical ??
      DEFAULT_VR_OVERLAY_SETTINGS.vertical,
  });

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  const update = (partial: Partial<VrOverlaySettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    const generalSettings: GeneralSettingsType = {
      ...currentDashboard.generalSettings,
      vr: next,
    };
    onDashboardUpdated({ ...currentDashboard, generalSettings });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 bg-slate-700 rounded">
        <h2 className="text-xl mb-1">VR</h2>
        <p className="text-slate-400">
          Position and size the VR overlay quad. Changes apply in real time
          while the overlay is running.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 p-4 mt-4">
        <SettingNumberRow
          title="Width (m)"
          description="Physical width of the overlay. Height follows your display aspect."
          value={settings.width}
          min={0.5}
          max={4}
          step={0.05}
          onChange={(width) => update({ width })}
        />

        <SettingNumberRow
          title="Distance (m)"
          description="How far in front of you the overlay sits."
          value={settings.distance}
          min={0.5}
          max={4}
          step={0.05}
          onChange={(distance) => update({ distance })}
        />

        <SettingNumberRow
          title="Left / Right (m)"
          description="Horizontal offset. Negative is left, positive is right."
          value={settings.horizontal}
          min={-2}
          max={2}
          step={0.05}
          onChange={(horizontal) => update({ horizontal })}
        />

        <SettingNumberRow
          title="Up / Down (m)"
          description="Vertical offset. Negative is down, positive is up."
          value={settings.vertical}
          min={-2}
          max={2}
          step={0.05}
          onChange={(vertical) => update({ vertical })}
        />

        <div className="p-3 bg-slate-700/50 rounded text-sm text-slate-400">
          The VR overlay is experimental and must be enabled at launch
          (IRDASHIES_VR=1). Use the &quot;Recenter VR Overlay&quot; key binding
          to bring the overlay back to your current head position.
        </div>
      </div>
    </div>
  );
};
